import { isPowersContract, getAllMandates, getAllRoleInfo, getOrgName, getOrgUri, getAmountRoleHolders, getRoleHolderAtIndex, } from './contract.js';
// PUBLIC_ROLE is type(uint256).max — skip it, every address holds it implicitly.
const PUBLIC_ROLE = (2n ** 256n) - 1n;
// Returns a map of lowercased address → roleIds it holds in the org.
async function buildMemberRoleMap(chainId, powersAddress, mandates) {
    const uniqueRoleIds = new Set();
    for (const m of mandates) {
        if (m.conditions.allowedRole !== PUBLIC_ROLE) {
            uniqueRoleIds.add(m.conditions.allowedRole);
        }
    }
    const memberRoles = new Map();
    await Promise.all(Array.from(uniqueRoleIds).map(async (roleId) => {
        try {
            const count = await getAmountRoleHolders(chainId, powersAddress, roleId);
            const fetches = [];
            for (let i = 0n; i < count; i++) {
                fetches.push(getRoleHolderAtIndex(chainId, powersAddress, roleId, i)
                    .then((addr) => {
                    const key = addr.toLowerCase();
                    const existing = memberRoles.get(key);
                    if (existing)
                        existing.push(roleId);
                    else
                        memberRoles.set(key, [roleId]);
                })
                    .catch(() => { }));
            }
            await Promise.all(fetches);
        }
        catch (err) {
            console.error(`[linkedInstances] failed to enumerate role ${roleId}:`, err);
        }
    }));
    return memberRoles;
}
export async function discoverLinkedInstances(chainId, powersAddress, mandates) {
    const memberRoleMap = await buildMemberRoleMap(chainId, powersAddress, mandates);
    if (memberRoleMap.size === 0)
        return [];
    const roleInfo = await getAllRoleInfo(chainId, powersAddress, mandates);
    // Check all members in parallel — filter to those that are Powers instances
    const checks = await Promise.all(Array.from(memberRoleMap.keys()).map(async (addrLower) => ({
        address: addrLower,
        roleIds: memberRoleMap.get(addrLower),
        isPowers: await isPowersContract(chainId, addrLower),
    })));
    const powersMembers = checks.filter((c) => c.isPowers);
    if (powersMembers.length === 0)
        return [];
    // Fetch governance context for each linked Powers instance in parallel
    const instances = await Promise.all(powersMembers.map(async ({ address, roleIds }) => {
        try {
            const [orgName, orgUri, childMandates] = await Promise.all([
                getOrgName(chainId, address),
                getOrgUri(chainId, address),
                getAllMandates(chainId, address),
            ]);
            const childRoleInfo = await getAllRoleInfo(chainId, address, childMandates);
            const activeMandates = childMandates.filter((m) => m.active);
            const mandateSummary = activeMandates
                .slice(0, 8)
                .map((m) => {
                const ri = childRoleInfo.get(m.conditions.allowedRole.toString());
                const roleName = ri?.label ?? m.conditions.allowedRole.toString();
                return `mandate #${m.mandateId} (role: ${roleName})`;
            })
                .join(', ');
            const rolesInParent = roleIds.map((roleId) => {
                const ri = roleInfo.get(roleId.toString());
                return { roleId, roleLabel: ri?.label ?? roleId.toString() };
            });
            return {
                address,
                chainId,
                orgName,
                orgUri,
                rolesInParent,
                mandateCount: activeMandates.length,
                mandateSummary: mandateSummary || '(none)',
            };
        }
        catch (err) {
            console.error(`[linkedInstances] failed to fetch context for ${address}:`, err);
            return null;
        }
    }));
    return instances.filter((i) => i !== null);
}
export function formatLinkedInstancesSummary(instances) {
    if (instances.length === 0)
        return '';
    const lines = [
        '=== LINKED POWERS INSTANCES ===',
        `${instances.length} member(s) of your organisation are themselves Powers DAO(s):`,
        '',
    ];
    instances.forEach((inst, idx) => {
        const roleStr = inst.rolesInParent.length > 0
            ? inst.rolesInParent
                .map((r) => `role ${r.roleId} ("${r.roleLabel}")`)
                .join(', ')
            : 'no named roles';
        lines.push(`[${idx + 1}] ${inst.orgName || inst.address} (${inst.address})`);
        lines.push(`    Holds: ${roleStr} in your org`);
        lines.push(`    Active mandates: ${inst.mandateCount} — ${inst.mandateSummary}`);
        if (inst.orgUri)
            lines.push(`    Metadata: ${inst.orgUri}`);
        lines.push('');
    });
    lines.push('=== END LINKED INSTANCES ===');
    return lines.join('\n');
}
