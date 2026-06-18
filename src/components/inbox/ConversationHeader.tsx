'use client';

import { Bot, User, X, Tag, UserCheck, ExternalLink } from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import type { Conversation } from '@/types';

interface ConversationHeaderProps {
  conversation: Conversation;
  businessId: string;
}

export function ConversationHeader({
  conversation,
  businessId,
}: ConversationHeaderProps) {
  const { assignToHuman, assignToBot, closeConversation, markAsRead } =
    useConversations({ businessId });

  const handleToggleAssignment = () => {
    if (conversation.assigned_to === 'bot') {
      assignToHuman(conversation.id);
    } else {
      assignToBot(conversation.id);
    }
  };

  // Mark as read when header is rendered (conversation is open)
  if (!conversation.is_read) {
    markAsRead(conversation.id);
  }

  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      {/* Left: Customer info */}
      <div className="flex items-center gap-3">
        {conversation.customer_profile_pic ? (
          <img
            src={conversation.customer_profile_pic}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-overlay text-ink-muted">
            <User className="h-4 w-4" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {conversation.customer_name || conversation.customer_username}
            </span>
            {conversation.customer_username && (
              <a
                href={`https://instagram.com/${conversation.customer_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-muted hover:text-accent transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            {conversation.assigned_to === 'bot' ? (
              <>
                <Bot className="h-3 w-3 text-bot" />
                <span>Bot handling</span>
              </>
            ) : (
              <>
                <UserCheck className="h-3 w-3 text-success" />
                <span>You&apos;re handling</span>
              </>
            )}
            {conversation.customer_email && (
              <>
                <span className="text-border-strong">·</span>
                <span>{conversation.customer_email}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleToggleAssignment}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-overlay transition-colors"
          title={
            conversation.assigned_to === 'bot'
              ? 'Take over from bot'
              : 'Hand back to bot'
          }
        >
          {conversation.assigned_to === 'bot' ? (
            <>
              <UserCheck className="h-3.5 w-3.5" />
              Take over
            </>
          ) : (
            <>
              <Bot className="h-3.5 w-3.5" />
              Hand to bot
            </>
          )}
        </button>

        <button
          onClick={() => closeConversation(conversation.id)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-danger-light hover:text-danger transition-colors"
          title="Close conversation"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>
    </div>
  );
}
