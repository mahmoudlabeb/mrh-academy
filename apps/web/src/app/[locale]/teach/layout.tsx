import { BlueprintWorkspaceShell } from "@/components/shared/BlueprintWorkspaceShell";

export default function TeachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BlueprintWorkspaceShell workspace="teach">
      {children}
    </BlueprintWorkspaceShell>
  );
}
