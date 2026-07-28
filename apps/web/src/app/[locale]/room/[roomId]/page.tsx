import ClassroomPage from "@/app/classroom/[roomId]/page";

export const dynamic = "force-dynamic";

export default function LocaleNativeClassroomPage() {
  return (
    <div className="blueprint-native-classroom">
      <ClassroomPage />
    </div>
  );
}
