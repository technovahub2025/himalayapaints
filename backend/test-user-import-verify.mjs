import { readFileSync } from "fs";

const baseUrl = "http://localhost:3001/api";
let authCookie = "";

async function login() {
    const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "himalayaadmin@gmail.com", password: "test@123" })
    });
    const data = await res.json();
    if (res.status !== 200) {
        throw new Error(`Login failed: ${JSON.stringify(data)}`);
    }
    const setCookie = res.headers.get("set-cookie");
    authCookie = setCookie ? setCookie.split(";")[0] : "";
    console.log("Login OK");
}

async function fetchAllMaterials() {
    const all = [];
    for (let off = 0; off <= 1000; off += 100) {
        const res = await fetch(`${baseUrl}/admin/raw-materials?limit=100&offset=${off}`, {
            headers: { Cookie: authCookie }
        });
        const data = await res.json().catch(() => ({}));
        const materials = Array.isArray(data.materials) ? data.materials : [];
        if (materials.length === 0) break;
        all.push(...materials);
    }
    return all;
}

async function main() {
    await login();

    // Clean up
    console.log("=== Clean up ===");
    const allMaterials = await fetchAllMaterials();
    const testCodes = allMaterials.filter(m => m.code?.startsWith("UT")).map(m => m.code);
    if (testCodes.length > 0) {
        await fetch(`${baseUrl}/admin/raw-materials`, {
            method: "DELETE",
            headers: { Cookie: authCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ codes: testCodes })
        });
        console.log(`Deleted ${testCodes.length} existing UT materials`);
    } else {
        console.log("No existing UT materials");
    }

    // Import Excel via user endpoint
    console.log("\n=== Import Excel via /api/raw-materials/import ===");
    const fileContent = readFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-user-import.xlsx");
    const formData = new FormData();
    formData.append("file", new Blob([fileContent]), "test-user-import.xlsx");
    const importRes = await fetch(`${baseUrl}/raw-materials/import`, {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData
    });
    const importData = await importRes.json();
    console.log(`Import: ${importData.imported} imported, ${importData.updated} updated, ${importData.failed} failed`);

    // Fetch via API and verify date field
    console.log("\n=== Verify API returns date field ===");
    const verifyMaterials = await fetchAllMaterials();
    const utMaterials = verifyMaterials.filter(m => m.code?.startsWith("UT")).sort((a, b) => a.code.localeCompare(b.code));
    console.log(`Found ${utMaterials.length} UT materials in API response`);
    utMaterials.forEach(m => {
        console.log(`  ${m.code} | ${m.name} | date=${m.date} | quantity=${m.quantity} | rate=${m.rate}`);
    });

    const hasDate = utMaterials.every(m => m.date !== undefined);
    const dateCount = utMaterials.filter(m => m.date).length;
    console.log("\nDate field present on all:", hasDate ? "PASS" : "FAIL");
    console.log(`Materials with date: ${dateCount}/${utMaterials.length}`);
    console.log("Rate still in model:", utMaterials.every(m => m.rate !== undefined) ? "PASS" : "FAIL");

    // Cleanup
    const finalCodes = utMaterials.map(m => m.code);
    await fetch(`${baseUrl}/admin/raw-materials`, {
        method: "DELETE",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ codes: finalCodes })
    });
    console.log(`\nCleaned up ${finalCodes.length} UT materials`);
    console.log("\n=== End-to-end test completed ===");
}

main().catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
});
