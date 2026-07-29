import { BlueprintWorkspaceShell } from "@/components/shared/BlueprintWorkspaceShell";

export default function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BlueprintWorkspaceShell workspace="learn">
      {children}
    </BlueprintWorkspaceShell>
  );
}
