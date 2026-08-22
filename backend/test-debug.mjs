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
    const setCookie = res.headers.get("set-cookie");
    authCookie = setCookie ? setCookie.split(";")[0] : "";
    if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(data)}`);
    console.log("Login OK");
}

async function main() {
    await login();

    // Check total count before import
    console.log("\n=== Before import: total count ===");
    const beforeRes = await fetch(`${baseUrl}/admin/raw-materials?limit=100`, {
        headers: { Cookie: authCookie }
    });
    const beforeData = await beforeRes.json();
    console.log("Status:", beforeRes.status);
    console.log("Total:", beforeData.total);
    console.log("Materials returned:", beforeData.materials?.length || 0);
    console.log("HasMore:", beforeData.hasMore);

    // Upload
    console.log("\n=== Upload test file ===");
    const fileContent = readFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-import.xlsx");
    const formData = new FormData();
    formData.append("file", new Blob([fileContent]), "test-import.xlsx");

    const importRes = await fetch(`${baseUrl}/admin/raw-materials/import`, {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData
    });
    const importData = await importRes.json();
    console.log("Import status:", importRes.status);
    console.log("Import result:", JSON.stringify(importData, null, 2));

    // Check total count after import
    console.log("\n=== After import: total count ===");
    const afterRes = await fetch(`${baseUrl}/admin/raw-materials?limit=100`, {
        headers: { Cookie: authCookie }
    });
    const afterData = await afterRes.json();
    console.log("Status:", afterRes.status);
    console.log("Total:", afterData.total);
    console.log("Materials returned:", afterData.materials?.length || 0);
    console.log("HasMore:", afterData.hasMore);

    // Show all materials
    const allMaterials = Array.isArray(afterData.materials) ? afterData.materials : [];
    console.log("\n=== All materials in DB ===");
    allMaterials.forEach(m => console.log(`  ${m.code} | ${m.name} | ${m.rate}`));

    // Filter for TEST
    const testMaterials = allMaterials.filter(m => m.code?.startsWith("TEST"));
    console.log("\n=== TEST materials ===");
    console.log("Count:", testMaterials.length);
    testMaterials.forEach(m => console.log(`  ${m.code} | ${m.name} | ${m.rate}`));

    // If no TEST materials found but total increased, try fetching more pages
    if (testMaterials.length === 0 && afterData.total > (beforeData.total || 0)) {
        console.log("\n=== TEST materials not in first page. Fetching all... ===");
        let offset = 100;
        let allFound = [];
        while (true) {
            const res = await fetch(`${baseUrl}/admin/raw-materials?limit=100&offset=${offset}`, {
                headers: { Cookie: authCookie }
            });
            const data = await res.json();
            const materials = Array.isArray(data.materials) ? data.materials : [];
            if (materials.length === 0) break;
            allFound = [...allFound, ...materials];
            if (!data.hasMore) break;
            offset += 100;
        }
        console.log("Additional materials found:", allFound.length);
        const additionalTest = allFound.filter(m => m.code?.startsWith("TEST"));
        console.log("Additional TEST materials:", additionalTest.length);
        additionalTest.forEach(m => console.log(`  ${m.code} | ${m.name} | ${m.rate}`));
    }

    // Cleanup
    console.log("\n=== Cleanup ===");
    if (testMaterials.length > 0 || afterData.total > (beforeData.total || 0)) {
        const allTest = [...testMaterials];
        if (testMaterials.length === 0) {
            // Need to search specifically
            const searchRes = await fetch(`${baseUrl}/admin/raw-materials?limit=100&search=TEST`, {
                headers: { Cookie: authCookie }
            });
            const searchData = await searchRes.json();
            const searchResults = Array.isArray(searchData.materials) ? searchData.materials : [];
            allTest.push(...searchResults);
        }
        if (allTest.length > 0) {
            const codes = allTest.map(m => m.code);
            console.log("Deleting codes:", codes);
            const delRes = await fetch(`${baseUrl}/admin/raw-materials`, {
                method: "DELETE",
                headers: { Cookie: authCookie, "Content-Type": "application/json" },
                body: JSON.stringify({ codes })
            });
            const delData = await delRes.json();
            console.log("Delete result:", delData);
        }
    }

    console.log("\n=== Done ===");
}

main().catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
});
