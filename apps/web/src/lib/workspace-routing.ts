type WorkspaceLocale = "ar" | "en";

export function workspaceHomeForRole(
  locale: WorkspaceLocale,
  role: string,
): string {
  if (role === "tutor") return `/${locale}/teach`;
  if (role === "admin" || role === "subadmin") return `/${locale}/ops`;
  if (role === "student") return `/${locale}/learn`;
  return `/${locale}/account/profile`;
}

export function authenticatedGuestDestination(
  requestedPath: string,
  role: string,
): string | null {
  const hashIndex = requestedPath.indexOf("#");
  const sourceHash = hashIndex >= 0 ? requestedPath.slice(hashIndex) : "";
  const withoutHash =
    hashIndex >= 0 ? requestedPath.slice(0, hashIndex) : requestedPath;
  const searchIndex = withoutHash.indexOf("?");
  const sourceSearch = searchIndex >= 0 ? withoutHash.slice(searchIndex) : "";
  const pathname =
    searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash;
  const match = pathname.match(/^\/(ar|en)(\/.*)?$/);
  if (!match) return null;

  const locale = match[1] as WorkspaceLocale;
  const route = match[2] || "/";
  const home = workspaceHomeForRole(locale, role);

  if (route === "/") return home;
  if (route === "/sign-in" || route === "/sign-up") return home;

  const tutorRoute = route.match(/^\/tutors(\/.*)?$/);
  if (tutorRoute) {
    return role === "student"
      ? `/${locale}/learn/tutors${tutorRoute[1] ?? ""}${sourceSearch}${sourceHash}`
      : home;
  }

  const courseRoute = route.match(/^\/courses(\/.*)?$/);
  if (courseRoute) {
    if (role !== "student") return home;
    return courseRoute[1]
      ? `/${locale}/learn/courses/catalog${courseRoute[1]}${sourceSearch}${sourceHash}`
      : `/${locale}/learn/courses${sourceSearch}#catalog`;
  }

  return null;
}
