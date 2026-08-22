import { writeFileSync } from "fs";
import XLSX from "xlsx";

const worksheetData = [
    ["Code", "Material Name", "Rate"],
    ["TEST001", "Test Material Alpha", 150],
    ["TEST002", "Test Material Beta", 80],
    ["TEST003", "Test Material Gamma", 220],
    ["TEST004", "Test Material Delta", 45],
    ["TEST005", "Test Material Epsilon", 99.99],
    ["TEST001", "Test Material Alpha Updated", 175],
    ["TEST006", "", 50],
    ["TEST007", "Test Material Zeta", "not-a-number"],
    ["TEST008", "Test Material Eta", 75],
    ["", "", ""],
    ["TEST009", "Test Material Theta", 120]
];

const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "RawMaterials");
const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
writeFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-import.xlsx", buffer);
console.log("Test Excel file created: test-import.xlsx");
console.log("Expected results:");
console.log("  Row 2 (TEST001): new insert -> imported");
console.log("  Row 3 (TEST002): new insert -> imported");
console.log("  Row 4 (TEST003): new insert -> imported");
console.log("  Row 5 (TEST004): new insert -> imported");
console.log("  Row 6 (TEST005): new insert -> imported");
console.log("  Row 7 (TEST001): duplicate code in file -> updated");
console.log("  Row 8 (TEST006): empty name -> failed");
console.log("  Row 9 (TEST007): invalid rate -> failed");
console.log("  Row 10 (TEST008): new insert -> imported");
console.log("  Row 11: empty row -> skipped");
console.log("  Row 12 (TEST009): new insert -> imported");
