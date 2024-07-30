import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ICreateConversation } from '../interfaces/create-conversation.interface';

@Injectable()
export class CreateConversationService {
  constructor(private prismaService: PrismaService) {}

  async createOrFind(
    profileId: string,
    participantId: string,
  ): Promise<ICreateConversation> {
    const profile = await this.prismaService.profile.findFirst({
      where: { AND: [{ id: profileId }, { id: participantId }] },
      select: { id: true },
    });

    if (!profile) throw new Error('Profile not found');

    const conversation = await this.prismaService.conversation.findFirst({
      where: {
        // blockedConversation: {
        //   every: {
        //     blocked: false,
        //     profileId: {
        //       in: [profileId, participantId],
        //     },
        //   },
        // },
        participants: {
          every: {
            profileId: {
              in: [profileId, participantId],
            },
          },
        },
      },
      select: { id: true },
    });

    if (conversation) return { conversationId: conversation.id };

    return await this.prismaService.$transaction(async (prisma) => {
      const { id: conversationId } = await prisma.conversation.create({
        select: { id: true },
      });

      const [historyId1, historyId2] = await prisma.history.createManyAndReturn(
        {
          data: [{}, {}],
        },
      );

      await prisma.conversationOnProfile.createManyAndReturn({
        data: [
          { conversationId, profileId, historyId: historyId1.id },
          {
            conversationId,
            profileId: participantId,
            historyId: historyId2.id,
          },
        ],
      });

      return { conversationId };
    });
  }
}
