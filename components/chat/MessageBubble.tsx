export function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:text-base ${
          isUser
            ? "bg-navy text-ivory rounded-br-sm"
            : "bg-white text-navy border border-navy/10 rounded-bl-sm"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
