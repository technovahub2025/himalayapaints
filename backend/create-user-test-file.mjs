import { writeFileSync } from "fs";
import XLSX from "xlsx";

const worksheetData = [
    ["Name", "Code", "Date", "Quantity", "Rate"],
    ["USERTEST001", "UT001", "26-08-2026", "100", "150"],
    ["USERTEST002", "UT002", "2026-08-25", "50", "80"],
    ["USERTEST003", "UT003", "25/08/2026", "0", "220"],
    ["USERTEST004", "UT004", "26-08-2026", "10", "45"],
    ["USERTEST001-DUP", "UT999", "27-08-2026", "75", "99.99"],
    ["", "UT006", "26-08-2026", "20", "75"],
    ["USERTEST007", "UT007", "not-a-date", "60", "120"],
    ["USERTEST008", "UT008", "26-08-2026", "40", "300"],
    ["", "", "", "", ""],
    ["USERTEST009", "UT009", "26-08-2026", "40", "110"]
];

const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "RawMaterials");
const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
writeFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-user-import.xlsx", buffer);
console.log("Test Excel file created: test-user-import.xlsx");
console.log("Expected results for user import:");
console.log("  TEST001: imported (new)");
console.log("  TEST002: imported (new, ISO date)");
console.log("  TEST003: imported (new, DMY date)");
console.log("  TEST004: imported (new)");
console.log("  TEST001-DUP: imported (new, different code)");
console.log("  TEST006: failed (missing name)");
console.log("  TEST007: failed (invalid date)");
console.log("  TEST008: imported (new)");
console.log("  empty row: skipped");
console.log("  TEST009: imported (new)");
