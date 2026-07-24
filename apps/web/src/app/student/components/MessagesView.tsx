"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/contexts/language-context";

type Contact = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    isRead: boolean;
    senderId: string;
  } | null;
  unreadCount: number;
};

type MessageData = {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
};

type TargetTutor = {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

function errorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(" ");
  }
  return fallback;
}

export default function MessagesView({
  initialSelectedUserId,
}: {
  initialSelectedUserId?: string | null;
} = {}) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const targetTutorId = initialSelectedUserId ?? searchParams.get("with");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    targetTutorId,
  );
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: contacts = [],
    isLoading: loadingContacts,
    error: contactsError,
  } = useQuery<Contact[]>({
    queryKey: ["messages", "contacts"],
    queryFn: async () => {
      const { data } = await apiClient.get("/messages/contacts");
      return data;
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const {
    data: targetTutor,
    isLoading: loadingTarget,
    error: targetError,
  } = useQuery<TargetTutor>({
    queryKey: ["messages", "target-tutor", targetTutorId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/tutors/${targetTutorId}`);
      return data;
    },
    enabled:
      !!targetTutorId &&
      !contacts.some((contact) => contact.user.id === targetTutorId),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (targetTutorId) setSelectedUserId(targetTutorId);
  }, [targetTutorId]);

  const targetContact = useMemo<Contact | null>(() => {
    if (!targetTutor || targetTutor.userId !== targetTutorId) return null;
    return {
      user: {
        id: targetTutor.userId,
        firstName: targetTutor.user.firstName,
        lastName: targetTutor.user.lastName,
        avatarUrl: targetTutor.user.avatarUrl,
      },
      lastMessage: null,
      unreadCount: 0,
    };
  }, [targetTutor, targetTutorId]);

  const visibleContacts = useMemo(() => {
    if (!targetContact) return contacts;
    return [
      targetContact,
      ...contacts.filter(
        (contact) => contact.user.id !== targetContact.user.id,
      ),
    ];
  }, [contacts, targetContact]);

  const { data: conversationData, isLoading: loadingMessages } = useQuery<{
    messages: MessageData[];
    total: number;
  }>({
    queryKey: ["messages", "conversation", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return { messages: [], total: 0 };
      const { data } = await apiClient.get(`/messages/${selectedUserId}`);
      return data;
    },
    enabled: !!selectedUserId && (!!targetContact || !loadingTarget),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const messages = useMemo(
    () => conversationData?.messages ?? [],
    [conversationData],
  );

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedUserId) throw new Error("No recipient selected");
      await apiClient.post("/messages", {
        receiverId: selectedUserId,
        content,
      });
    },
    onSuccess: async () => {
      setMessageInput("");
      await queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const handleSend = () => {
    const content = messageInput.trim();
    if (!content || !selectedUserId || sendMutation.isPending) return;
    sendMutation.mutate(content);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeContact = visibleContacts.find(
    (contact) => contact.user.id === selectedUserId,
  );
  const loadingInitialTarget =
    !!targetTutorId && loadingTarget && !activeContact;
  const sendError = sendMutation.isError
    ? errorMessage(
        sendMutation.error,
        t(
          "تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.",
          "The message could not be sent. Please try again.",
        ),
      )
    : null;

  return (
    <div
      className="card flex h-[600px] overflow-hidden max-md:h-[70vh] max-md:flex-col"
      style={{ border: "1px solid var(--border-color)" }}
    >
      <aside
        className="w-80 shrink-0 flex flex-col border-l max-md:w-full max-md:h-52 max-md:border-l-0 max-md:border-b"
        style={{
          borderColor: "var(--border-color)",
          background: "var(--bg-light)",
        }}
        aria-label={t("قائمة المحادثات", "Conversation list")}
      >
        <div
          className="p-4 border-b"
          style={{ borderColor: "var(--border-color)" }}
        >
          <h3
            className="font-bold text-sm"
            style={{ color: "var(--text-main)" }}
          >
            {t("الرسائل", "Messages")}
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div
              className="space-y-2 p-3"
              aria-label={t("جارٍ التحميل", "Loading")}
            >
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-full skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 skeleton" />
                    <div className="h-2.5 w-32 skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : contactsError ? (
            <p className="p-5 text-sm text-center text-red-500" role="alert">
              {t("تعذر تحميل المحادثات.", "Could not load conversations.")}
            </p>
          ) : targetError && targetTutorId && visibleContacts.length === 0 ? (
            <p className="p-5 text-sm text-center text-red-500" role="alert">
              {t(
                "تعذر تحميل بيانات المعلم المحدد.",
                "Could not load the selected tutor.",
              )}
            </p>
          ) : visibleContacts.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                {t("لا توجد رسائل", "No messages")}
              </p>
            </div>
          ) : (
            visibleContacts.map((contact) => (
              <button
                type="button"
                key={contact.user.id}
                onClick={() => setSelectedUserId(contact.user.id)}
                className="w-full px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/5"
                style={{
                  background:
                    selectedUserId === contact.user.id
                      ? "rgba(212, 163, 83,0.08)"
                      : "transparent",
                  borderInlineEnd:
                    selectedUserId === contact.user.id
                      ? "3px solid #D4A353"
                      : "3px solid transparent",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden"
                  style={{ background: "#D4A353", color: "#0F3A40" }}
                >
                  {contact.user.avatarUrl ? (
                    <Image
                      src={contact.user.avatarUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (contact.user.firstName?.[0] ?? "?")
                  )}
                </div>
                <div className="flex-1 min-w-0 text-start">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text-main)" }}
                    >
                      {contact.user.firstName} {contact.user.lastName}
                    </span>
                    {contact.lastMessage && (
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {new Date(
                          contact.lastMessage.createdAt,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {contact.lastMessage?.content ??
                        t("ابدأ محادثة جديدة", "Start a new conversation")}
                    </span>
                    {contact.unreadCount > 0 && (
                      <span
                        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: "#D4A353", color: "#0F3A40" }}
                      >
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        {activeContact ? (
          <>
            <header
              className="p-4 border-b flex items-center gap-3"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--bg-light)",
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden"
                style={{ background: "#D4A353", color: "#0F3A40" }}
              >
                {activeContact.user.avatarUrl ? (
                  <Image
                    src={activeContact.user.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (activeContact.user.firstName?.[0] ?? "?")
                )}
              </div>
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-main)" }}
                >
                  {activeContact.user.firstName} {activeContact.user.lastName}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t("المعلم المحدد", "Selected tutor")}
                </p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className={`flex ${item % 2 === 0 ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`${item % 2 === 0 ? "w-48" : "w-36"} h-8 skeleton rounded-xl`}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-5">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--text-main)" }}
                  >
                    {t(
                      `ابدأ محادثتك مع ${activeContact.user.firstName}`,
                      `Start a conversation with ${activeContact.user.firstName}`,
                    )}
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t(
                      "اسأل عن أسلوب التدريس أو المواعيد المتاحة.",
                      "Ask about teaching style or available times.",
                    )}
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId !== selectedUserId;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine ? "rounded-br-md" : "rounded-bl-md"
                        }`}
                        style={{
                          background: isMine ? "#D4A353" : "var(--bg-light)",
                          color: isMine ? "#0F3A40" : "var(--text-main)",
                        }}
                      >
                        <p>{message.content}</p>
                        <p className="text-[10px] mt-1 opacity-70" dir="ltr">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer
              className="p-4 border-t"
              style={{
                borderColor: "var(--border-color)",
                background: "var(--bg-light)",
              }}
            >
              <div className="flex items-center gap-2">
                <label htmlFor="student-message-input" className="sr-only">
                  {t("اكتب رسالة", "Type a message")}
                </label>
                <input
                  id="student-message-input"
                  type="text"
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t("اكتب رسالة…", "Type a message…")}
                  className="input-field text-sm flex-1"
                  disabled={sendMutation.isPending}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                  className="btn-primary px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendMutation.isPending
                    ? t("جارٍ الإرسال…", "Sending…")
                    : t("إرسال", "Send")}
                </button>
              </div>
              {sendError && (
                <p className="mt-2 text-xs text-red-500" role="alert">
                  {sendError}
                </p>
              )}
            </footer>
          </>
        ) : loadingInitialTarget ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t("جارٍ فتح المحادثة…", "Opening conversation…")}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {t(
                "اختر محادثة من القائمة",
                "Select a conversation from the list",
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
