export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {messages.join(" ")}
    </p>
  );
}
