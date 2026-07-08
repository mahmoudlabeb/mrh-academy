'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import Image from 'next/image';

type Contact = {
  user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  lastMessage: { id: string; content: string; createdAt: string; isRead: boolean; senderId: string } | null;
  unreadCount: number;
};

type MessageData = {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
};

export default function MessagesView() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = (ar: string, en: string) => (isAr ? ar : en);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ['messages', 'contacts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/messages/contacts');
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: conversationData, isLoading: loadingMessages } = useQuery<{
    messages: MessageData[];
    total: number;
  }>({
    queryKey: ['messages', 'conversation', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return { messages: [], total: 0 };
      const { data } = await apiClient.get(`/messages/${selectedUserId}`);
      return data;
    },
    enabled: !!selectedUserId,
    refetchInterval: 5000,
  });

  const messages = useMemo(() => conversationData?.messages ?? [], [conversationData]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiClient.post('/messages', { receiverId: selectedUserId, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setMessageInput('');
    },
  });

  const handleSend = () => {
    if (!messageInput.trim() || !selectedUserId) return;
    sendMutation.mutate(messageInput.trim());
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeContact = contacts.find((c) => c.user.id === selectedUserId);

  return (
    <div className="card flex h-[600px] overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      <div className="w-80 shrink-0 flex flex-col border-l" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
            {t('الرسائل', 'Messages')}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 skeleton" />
                    <div className="h-2.5 w-32 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('لا توجد رسائل', 'No messages')}
              </p>
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.user.id}
                onClick={() => setSelectedUserId(contact.user.id)}
                className="w-full text-right px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/5"
                style={{
                  background: selectedUserId === contact.user.id ? 'rgba(212, 163, 83,0.08)' : 'transparent',
                  borderRight: selectedUserId === contact.user.id ? '3px solid #D4A353' : '3px solid transparent',
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden" style={{ background: '#D4A353' }}>
                  {contact.user.avatarUrl ? (
                    <Image src={contact.user.avatarUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    contact.user.firstName?.[0] ?? '?'
                  )}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                      {contact.user.firstName} {contact.user.lastName}
                    </span>
                    {contact.lastMessage && (
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {new Date(contact.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {contact.lastMessage?.content ?? t('بدون رسائل', 'No messages')}
                    </span>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#D4A353' }}>
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activeContact ? (
          <>
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: '#D4A353' }}>
                {activeContact.user.firstName?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                  {activeContact.user.firstName} {activeContact.user.lastName}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className={`${i % 2 === 0 ? 'w-48' : 'w-36'} h-8 skeleton rounded-xl`} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {t('ابدأ المحادثة...', 'Start the conversation...')}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId !== selectedUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine ? 'rounded-br-md' : 'rounded-bl-md'
                        }`}
                        style={{
                          background: isMine ? '#D4A353' : 'var(--bg-light)',
                          color: isMine ? '#0F3A40' : 'var(--text-main)',
                        }}
                      >
                        <p>{msg.content}</p>
                        <p className="text-[10px] mt-1 opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t('اكتب رسالة...', 'Type a message...')}
                  className="input-field text-sm flex-1"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                  className="btn-primary p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendMutation.isPending ? '...' : t('إرسال', 'Send')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('اختر محادثة من القائمة', 'Select a conversation from the list')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
