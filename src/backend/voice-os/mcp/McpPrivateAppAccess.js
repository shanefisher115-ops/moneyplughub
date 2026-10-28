export class McpPrivateAppAccess {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    verifyAccess(identity) {
        const allowedRoles = ["admin", "operator", "finance"];
        const roleAllowed = allowedRoles.includes(identity.role);
        const postureValid = (identity.devicePosture?.trustScore ?? 0) >= 80;
        const access = roleAllowed && postureValid;
        const payload = {
            userId: identity.userId,
            role: identity.role,
            postureValid,
            access
        };
        this.bus.emit("MCP_IDENTITY", payload);
        return access;
    }
}
