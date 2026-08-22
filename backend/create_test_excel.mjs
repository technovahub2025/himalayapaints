import XLSX from "xlsx";
import { writeFileSync } from "fs";
const worksheetData = [
    ["Code", "Material Name", "Rate", "Quantity"],
    ["IMP001", "Imported Material A", 100, 10],
    ["IMP002", "Imported Material B", 200, 20]
];
const ws = XLSX.utils.aoa_to_sheet(worksheetData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "RawMaterials");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync("test-import.xlsx", buf);
console.log("Created test-import.xlsx with", worksheetData.length - 1, "data rows");
