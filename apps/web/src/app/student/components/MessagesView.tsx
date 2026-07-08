'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';

interface Contact {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export default function MessagesView() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['message-contacts'],
    queryFn: async () => {
      const { data } = await apiClient.get<Contact[]>('/messages/contacts');
      return data;
    },
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data } = await apiClient.get<Message[]>(`/messages/${selectedUserId}`);
      return data;
    },
    enabled: !!selectedUserId,
  });

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      await apiClient.post(`/messages/${selectedUserId}`, { text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['message-contacts'] });
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = messageInput.trim();
    if (!text || !selectedUserId) return;
    sendMutation.mutate(text);
    setMessageInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return lang === 'ar' ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="card flex h-[600px] overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      <div className="w-80 shrink-0 flex flex-col border-l" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
            {lang === 'ar' ? 'الرسائل' : 'Messages'}
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
              <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'لا توجد رسائل' : 'No messages'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'احجز درساً لبدء المحادثة' : 'Book a lesson to start chatting'}
              </p>
            </div>
          ) : (
            contacts.map((contact) => (
              <button
                key={contact.userId}
                onClick={() => setSelectedUserId(contact.userId)}
                className="w-full text-right px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/5"
                style={{
                  background: selectedUserId === contact.userId ? 'rgba(212, 163, 83,0.08)' : 'transparent',
                  borderRight: selectedUserId === contact.userId ? '3px solid #D4A353' : '3px solid transparent',
                }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: '#D4A353' }}>
                  {contact.firstName[0]}
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {formatTime(contact.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {contact.lastMessage}
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
        {selectedUserId ? (
          <>
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: '#D4A353' }}>
                {contacts.find((c) => c.userId === selectedUserId)?.firstName?.[0] || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                  {contacts.find((c) => c.userId === selectedUserId)?.firstName}{' '}
                  {contacts.find((c) => c.userId === selectedUserId)?.lastName}
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
                    {lang === 'ar' ? 'ابدأ المحادثة...' : 'Start the conversation...'}
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
                          borderBottomRightRadius: isMine ? '4px' : undefined,
                          borderBottomLeftRadius: !isMine ? '4px' : undefined,
                        }}
                      >
                        <p>{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-right opacity-70' : 'text-left'}`} style={{ color: isMine ? 'rgba(15, 58, 64,0.6)' : 'var(--text-muted)' }}>
                          {new Date(msg.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-light)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={lang === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
                  className="input-field text-sm flex-1"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                  className="btn-primary p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendMutation.isPending ? (
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={lang === 'ar' ? 'M10 19l-7-7m0 0l7-7m-7 7h18' : 'M10 19l-7-7m0 0l7-7m-7 7h18'} />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212, 163, 83,0.1)' }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#D4A353">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-main)' }}>
                {lang === 'ar' ? 'رسائلك' : 'Your Messages'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ar' ? 'اختر محادثة من القائمة' : 'Select a conversation from the list'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
