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

  const t = (ar: string, en: string) => isAr ? ar : en;

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ['messages', 'contacts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/messages/contacts');
      return data;
    },
    refetchInterval: 10000,
  });

  const { data: conversationData, isLoading: loadingMessages } = useQuery<{ messages: MessageData[]; total: number }>({
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
    <div className="flex h-[calc(100vh-140px)] rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
      <div className="w-72 flex-shrink-0 border-l overflow-y-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>{t('الرسائل', 'Messages')}</h3>
        </div>
        {loadingContacts ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 skeleton" />
                  <div className="h-2 w-32 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('لا توجد محادثات', 'No conversations')}</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.user.id}
              onClick={() => setSelectedUserId(contact.user.id)}
              className="w-full text-right px-4 py-3 flex items-center gap-3 transition-colors"
              style={{
                background: selectedUserId === contact.user.id ? 'rgba(212, 163, 83,0.1)' : 'transparent',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: 'rgba(212, 163, 83,0.15)', color: 'var(--primary-color)' }}>
                {contact.user.avatarUrl ? (
                  <Image src={contact.user.avatarUrl} alt="" width={40} height={40} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (contact.user.firstName?.[0] ?? '?')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-main)' }}>{contact.user.firstName} {contact.user.lastName}</span>
                  {contact.lastMessage && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {new Date(contact.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {contact.lastMessage?.content ?? t('بدون رسائل', 'No messages')}
                </p>
              </div>
              {contact.unreadCount > 0 && (
                <span className="badge flex-shrink-0 text-xs font-bold px-2 py-0.5" style={{ background: 'var(--primary-color)', color: '#0F3A40' }}>
                  {contact.unreadCount}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {activeContact ? (
          <>
            <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(212, 163, 83,0.15)', color: 'var(--primary-color)' }}>
                {activeContact.user.avatarUrl ? (
                  <Image src={activeContact.user.avatarUrl} alt="" width={36} height={36} className="w-full h-full rounded-full object-cover" />
                ) : (
                  (activeContact.user.firstName?.[0] ?? '?')
                )}
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{activeContact.user.firstName} {activeContact.user.lastName}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      <div className="h-12 w-40 skeleton rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ابدأ المحادثة', 'Start the conversation')}</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId !== selectedUserId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${
                        isMe ? 'rounded-br-md' : 'rounded-bl-md'
                      }`} style={{
                        background: isMe ? 'var(--primary-color)' : 'var(--bg-light)',
                        color: isMe ? '#0F3A40' : 'var(--text-main)',
                      }}>
                        <p>{msg.content}</p>
                        <p className="text-xs mt-1 opacity-60">
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
              <div className="flex gap-3">
                <input
                  className="flex-1 input-field"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder={t('اكتب رسالة...', 'Type a message...')}
                  disabled={sendMutation.isPending}
                />
                <button onClick={handleSend} className="btn-primary px-4" disabled={sendMutation.isPending || !messageInput.trim()}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p style={{ color: 'var(--text-muted)' }}>{t('اختر محادثة', 'Select a conversation')}</p>
          </div>
        )}
      </div>
    </div>
  );
}