import { randomUUID as uuid } from "crypto";
export class McpIdentityGateway {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    issueServiceToken(userId) {
        const token = uuid();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        return { token, expiresAt };
    }
    validateDevicePosture(posture) {
        const { warpConnected, diskEncrypted, firewallEnabled, trustScore = 0 } = posture || {};
        if (!posture)
            return false;
        return Boolean(warpConnected && diskEncrypted && firewallEnabled && trustScore >= 80);
    }
    bindIdentity(sessionId, identity) {
        const payload = {
            sessionId,
            userId: identity.userId,
            devicePosture: identity.devicePosture,
            serviceToken: identity.serviceToken,
            identityConfidence: identity.confidence
        };
        this.bus.emit("MCP_IDENTITY", payload);
        return payload;
    }
}
