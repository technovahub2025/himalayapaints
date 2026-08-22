import fetch from "node:http";
import { URL } from "url";

const baseUrl = "http://localhost:3001/api";
const cookieJar = {};

function parseCookies(headers) {
    const setCookie = headers["set-cookie"];
    if (!setCookie) return "";
    return Array.isArray(setCookie) ? setCookie[0] : setCookie;
}

function makeRequest(path, options = {}) {
    const url = new URL(baseUrl + path);
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    };
    if (cookieJar.session) {
        headers["Cookie"] = cookieJar.session;
    }
    return new Promise((resolve, reject) => {
        const req = fetch.request(url, {
            method: options.method || "GET",
            headers,
        }, (res) => {
            let body = "";
            res.on("data", (chunk) => body += chunk);
            res.on("end", () => {
                if (res.headers["set-cookie"] && !cookieJar.session) {
                    cookieJar.session = parseCookies(res.headers).split(";")[0];
                }
                resolve({ status: res.statusCode, headers: res.headers, body: body });
            });
        });
        req.on("error", reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function main() {
    // Step 1: Login
    console.log("=== Step 1: Login ===");
    const loginRes = await makeRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "himalayaadmin@gmail.com", password: "test@123" })
    });
    console.log("Login status:", loginRes.status);
    console.log("Login body:", loginRes.body);
    console.log("Cookie:", cookieJar.session);

    if (loginRes.status !== 200) {
        throw new Error("Login failed");
    }

    // Step 2: Check existing materials
    console.log("\n=== Step 2: Check existing TEST materials ===");
    const existingRes = await makeRequest("/admin/raw-materials?limit=100");
    const existingData = JSON.parse(existingRes.body);
    const existingTest = existingData.materials
        .filter(m => m.code?.startsWith("TEST"))
        .map(m => `${m.code} | ${m.name} | ${m.rate}`);
    console.log("Existing TEST materials:", existingTest.length, existingTest);

    console.log("\n=== All prerequisites check passed ===");
    console.log("Backend is running and MongoDB is connected.");
    console.log("Ready to test import endpoint with proper HTTP client.");
}

main().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
