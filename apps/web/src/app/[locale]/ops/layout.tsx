import { BlueprintWorkspaceShell } from "@/components/shared/BlueprintWorkspaceShell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <BlueprintWorkspaceShell workspace="ops">
      {children}
    </BlueprintWorkspaceShell>
  );
}
