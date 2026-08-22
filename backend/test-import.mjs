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

async function get(path) {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: { Cookie: authCookie }
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function postFormData(path, formData) {
    const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Cookie: authCookie },
        body: formData
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function postJson(path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function main() {
    await login();

    // Clean up any existing TEST materials first
    console.log("\n=== Clean up existing TEST materials ===");
    const cleanRes = await get("/admin/raw-materials?limit=100");
    const cleanMaterials = Array.isArray(cleanRes.data.materials) ? cleanRes.data.materials : [];
    const testCodes = cleanMaterials.filter(m => m.code?.startsWith("TEST")).map(m => m.code);
    if (testCodes.length > 0) {
        await fetch(`${baseUrl}/admin/raw-materials`, {
            method: "DELETE",
            headers: { Cookie: authCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ codes: testCodes })
        });
        console.log(`Deleted ${testCodes.length} existing TEST materials`);
    }

    // Step 1: Upload test Excel file
    console.log("\n=== Step 1: Upload Excel file with 10 rows ===");
    const fileContent = readFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-import.xlsx");
    const formData = new FormData();
    formData.append("file", new Blob([fileContent]), "test-import.xlsx");

    const importRes = await postFormData("/admin/raw-materials/import", formData);
    console.log("Import response status:", importRes.status);
    console.log("Import response:", JSON.stringify(importRes.data, null, 2));

    // Verify response structure
    const d = importRes.data;
    console.log("\n--- Response Validation ---");
    console.log("success:", d.success === true ? "PASS" : "FAIL");
    console.log("message:", d.message || "FAIL");
    console.log("imported:", d.imported, "(expected ~6)");
    console.log("updated:", d.updated, "(expected ~1 - TEST001 dup)");
    console.log("skipped:", d.skipped, "(expected 1 - empty row)");
    console.log("failed:", d.failed, "(expected ~2)");
    console.log("errors array:", Array.isArray(d.errors) ? "PASS" : "FAIL");
    if (Array.isArray(d.errors) && d.errors.length > 0) {
        d.errors.forEach(e => console.log(`  Row ${e.row}: ${e.errors.join(", ")}`));
    }

    // Step 2: Verify database
    console.log("\n=== Step 2: Verify database ===");
    const verifyRes = await get("/admin/raw-materials?limit=100");
    const verifyMaterials = Array.isArray(verifyRes.data.materials) ? verifyRes.data.materials : [];
    const testMaterials = verifyMaterials.filter(m => m.code?.startsWith("TEST")).sort((a, b) => a.code.localeCompare(b.code));
    console.log("TEST materials in DB:", testMaterials.length);
    testMaterials.forEach(m => console.log(`  ${m.code} | ${m.name} | ${m.rate}`));

    // Verify TEST001 was updated (rate 175, name updated)
    const test001 = testMaterials.find(m => m.code === "TEST001");
    if (test001) {
        console.log("\nTEST001 upsert check:",
            test001.rate === 175 ? "rate updated to 175 PASS" : `rate is ${test001.rate} (expected 175) FAIL`,
            test001.name === "Test Material Alpha Updated" ? "name updated PASS" : `name is ${test001.name} FAIL`);
    }

    // Step 3: Test re-upload (idempotency - same file should update existing)
    console.log("\n=== Step 3: Re-upload same file (upsert test) ===");
    const formData2 = new FormData();
    formData2.append("file", fileContent, "test-import.xlsx");
    const reImportRes = await postFormData("/admin/raw-materials/import", formData2);
    console.log("Re-import response:", JSON.stringify(reImportRes.data, null, 2));
    console.log("updated should be > 0 (existing codes get updated):", reImportRes.data.updated > 0 ? "PASS" : "FAIL");

    // Step 4: Test no file
    console.log("\n=== Step 4: Test no file selected ===");
    const noFileRes = await postJson("/admin/raw-materials/import", {});
    console.log("No file - status:", noFileRes.status, "body:", JSON.stringify(noFileRes.data));
    console.log("Should be 400:", noFileRes.status === 400 ? "PASS" : "FAIL");

    // Step 5: Test invalid file type
    console.log("\n=== Step 5: Test invalid file type ===");
    const badFormData = new FormData();
    badFormData.append("file", new Blob([Buffer.from("hello world")]), "test.txt");
    const badRes = await postFormData("/admin/raw-materials/import", badFormData);
    console.log("Invalid type - status:", badRes.status, "body:", JSON.stringify(badRes.data));
    console.log("Should be 400:", badRes.status === 400 ? "PASS" : "FAIL");

    // Step 6: Test empty Excel file
    console.log("\n=== Step 6: Test empty Excel file ===");
    const XLSX = (await import("xlsx")).default || await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empty");
    const emptyBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const emptyFormData = new FormData();
    emptyFormData.append("file", new Blob([emptyBuf]), "empty.xlsx");
    const emptyRes = await postFormData("/admin/raw-materials/import", emptyFormData);
    console.log("Empty file - status:", emptyRes.status, "body:", JSON.stringify(emptyRes.data));
    console.log("Should be 400:", emptyRes.status === 400 ? "PASS" : "FAIL");

    // Step 7: Test missing columns
    console.log("\n=== Step 7: Test missing columns ===");
    const ws2 = XLSX.utils.aoa_to_sheet([["Foo", "Bar"], ["a", "b"]]);
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws2, "NoHeaders");
    const badHeaderBuf = XLSX.write(wb2, { type: "buffer", bookType: "xlsx" });
    const badHeaderFormData = new FormData();
    badHeaderFormData.append("file", new Blob([badHeaderBuf]), "noheaders.xlsx");
    const badHeaderRes = await postFormData("/admin/raw-materials/import", badHeaderFormData);
    console.log("Missing columns - status:", badHeaderRes.status, "body:", JSON.stringify(badHeaderRes.data));
    console.log("Should be 400:", badHeaderRes.status === 400 ? "PASS" : "FAIL");

    // Cleanup
    console.log("\n=== Cleanup: Delete test materials ===");
    const finalRes = await get("/admin/raw-materials?limit=100");
    const finalMaterials = Array.isArray(finalRes.data.materials) ? finalRes.data.materials : [];
    const finalTestCodes = finalMaterials.filter(m => m.code?.startsWith("TEST")).map(m => m.code);
    if (finalTestCodes.length > 0) {
        const delRes = await fetch(`${baseUrl}/admin/raw-materials`, {
            method: "DELETE",
            headers: { Cookie: authCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ codes: finalTestCodes })
        });
        const delData = await delRes.json();
        console.log(`Deleted ${delData.deletedCount} test materials`);
    }

    console.log("\n=== All tests completed ===");
}

main().catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
});
