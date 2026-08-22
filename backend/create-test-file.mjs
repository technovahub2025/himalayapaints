import XLSX from "xlsx";
import { writeFileSync } from "fs";

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
    ["TEST008", "Test Material Theta", 75],
    ["", "", ""],
    ["TEST009", "Test Material Theta 2", 120]
];

const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "RawMaterials");
const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
writeFileSync("C:\\Users\\Admin\\AppData\\Local\\Temp\\kilo\\test-import.xlsx", buffer);
console.log("Test Excel file created: test-import.xlsx");
console.log("Rows: 10 data rows + 1 empty row");
console.log("Expected: 6 imported, 0 updated (within same file, TEST001 dup = update), 1 skipped (empty), 2 failed");
