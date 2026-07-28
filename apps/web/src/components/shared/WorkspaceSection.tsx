export function WorkspaceSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="workspace-section">
      <header>
        {eyebrow && <p>{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <span>{description}</span>}
      </header>
      {children}
    </main>
  );
}
