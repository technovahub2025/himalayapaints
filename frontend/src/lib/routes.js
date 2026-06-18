export function roleRedirectPath(role) {
    return role === "admin" ? "/admin" : "/user";
}
