import XLSX from "xlsx";
import { writeFileSync } from "fs";
const worksheetData = [
    ["Code", "Material Name", "Rate"],
    ["NOCOL001", "No Quantity Column Material", 75]
];
const ws = XLSX.utils.aoa_to_sheet(worksheetData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "RawMaterials");
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync("test-noqty.xlsx", buf);
console.log("Created test-noqty.xlsx");
