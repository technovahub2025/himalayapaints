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
    console.log("Login OK. Cookie:", authCookie.substring(0, 30) + "...");
}

async function postFormData(path, formData) {
    const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
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

    // Clean up existing UT test materials
    console.log("\n=== Clean up existing UT materials ===");
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
        console.log("No existing UT materials to clean up");
    }

    // Step 1: Upload test Excel file to USER import endpoint
    console.log("\n=== Step 1: Upload Excel to /api/raw-materials/import (user endpoint) ===");
    const fileContent = readFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-user-import.xlsx");
    const formData = new FormData();
    formData.append("file", new Blob([fileContent]), "test-user-import.xlsx");

    const importRes = await postFormData("/raw-materials/import", formData);
    console.log("Import response status:", importRes.status);
    console.log("Import response:", JSON.stringify(importRes.data, null, 2));

    const d = importRes.data;
    console.log("\n--- Response Validation ---");
    console.log("success:", d.success === true ? "PASS" : "FAIL");
    console.log("message:", d.message || "FAIL");
    console.log("imported:", d.imported, "(expected 7)");
    console.log("updated:", d.updated, "(expected 0)");
    console.log("skipped:", d.skipped, "(expected 3: 1 empty + 2 errors)");
    console.log("failed:", d.failed, "(expected 2: missing name, invalid date)");
    console.log("errors array:", Array.isArray(d.errors) ? "PASS" : "FAIL");
    if (Array.isArray(d.errors) && d.errors.length > 0) {
        d.errors.forEach(e => console.log(`  Row ${e.row}: ${e.errors.join(", ")}`));
    }
    console.log("materials array:", Array.isArray(d.materials) ? `PASS (${d.materials.length} materials)` : "FAIL");

    // Step 2: Verify database
    console.log("\n=== Step 2: Verify database ===");
    const verifyMaterials = await fetchAllMaterials();
    const utMaterials = verifyMaterials.filter(m => m.code?.startsWith("UT")).sort((a, b) => a.code.localeCompare(b.code));
    console.log("UT materials in DB:", utMaterials.length);
    utMaterials.forEach(m => console.log(`  ${m.code} | ${m.name} | qty=${m.quantity} | rate=${m.rate} | date=${m.date}`));
    console.log("DB verify:", utMaterials.length === 7 ? "PASS" : "FAIL");

    // Step 3: Test re-upload (upsert for existing codes)
    console.log("\n=== Step 3: Re-upload same file (upsert test) ===");
    const formData2 = new FormData();
    formData2.append("file", new Blob([fileContent]), "test-user-import.xlsx");
    const reImportRes = await postFormData("/raw-materials/import", formData2);
    console.log("Re-import response:", JSON.stringify(reImportRes.data, null, 2));
    console.log("updated > 0 (existing codes updated):", reImportRes.data.updated > 0 ? "PASS" : "FAIL");

    // Step 4: Test no file
    console.log("\n=== Step 4: Test no file selected ===");
    const noFileRes = await fetch(`${baseUrl}/raw-materials/import`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({})
    });
    console.log("No file - status:", noFileRes.status);
    console.log("Should be 400:", noFileRes.status === 400 ? "PASS" : "FAIL");

    // Step 5: Test invalid file type
    console.log("\n=== Step 5: Test invalid file type ===");
    const badFormData = new FormData();
    badFormData.append("file", new Blob([Buffer.from("hello world")]), "test.txt");
    const badRes = await postFormData("/raw-materials/import", badFormData);
    console.log("Invalid type - status:", badRes.status, "body:", JSON.stringify(badRes.data));
    console.log("Should be 400:", badRes.status === 400 ? "PASS" : "FAIL");

    // Cleanup
    console.log("\n=== Cleanup: Delete UT test materials ===");
    const finalMaterials = await fetchAllMaterials();
    const finalTestCodes = finalMaterials.filter(m => m.code?.startsWith("UT")).map(m => m.code);
    if (finalTestCodes.length > 0) {
        const delRes = await fetch(`${baseUrl}/admin/raw-materials`, {
            method: "DELETE",
            headers: { Cookie: authCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ codes: finalTestCodes })
        });
        const delData = await delRes.json();
        console.log(`Deleted ${delData.deletedCount} UT materials`);
    }

    console.log("\n=== All user import tests completed ===");
}

main().catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
});
