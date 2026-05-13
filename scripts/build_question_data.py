from __future__ import annotations

import json
import textwrap
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE_XLSX = ROOT / "365_Brain.quiz.xlsx"
OUTPUT_JS = ROOT / "data" / "questions.js"
MAIN_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    shared_strings: list[str] = []

    for item in root.findall(f"{MAIN_NS}si"):
        parts = [node.text or "" for node in item.iter(f"{MAIN_NS}t")]
        shared_strings.append("".join(parts))

    return shared_strings


def read_cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value_node = cell.find(f"{MAIN_NS}v")
    if value_node is None:
        return ""

    raw = value_node.text or ""
    cell_type = cell.attrib.get("t")

    if cell_type == "s" and raw.isdigit():
        return shared_strings[int(raw)]

    return raw


def workbook_sheet_names(archive: zipfile.ZipFile) -> list[str]:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheets = workbook.find(f"{MAIN_NS}sheets")
    if sheets is None:
        return []
    return [sheet.attrib["name"] for sheet in sheets]


def extract_questions() -> dict[str, list[dict[str, str]]]:
    data: dict[str, list[dict[str, str]]] = {}

    with zipfile.ZipFile(SOURCE_XLSX) as archive:
        shared_strings = load_shared_strings(archive)
        sheet_names = workbook_sheet_names(archive)

        for index, sheet_name in enumerate(sheet_names, start=1):
            worksheet = ET.fromstring(archive.read(f"xl/worksheets/sheet{index}.xml"))
            sheet_data = worksheet.find(f"{MAIN_NS}sheetData")
            rows = list(sheet_data) if sheet_data is not None else []

            questions: list[dict[str, str]] = []

            for row in rows[1:]:
                cells = row.findall(f"{MAIN_NS}c")
                values = [read_cell_value(cell, shared_strings) for cell in cells]
                if not values:
                    continue

                question = values[0].strip() if len(values) > 0 else ""
                answer = values[1].strip() if len(values) > 1 else ""

                if not question and not answer:
                    continue

                questions.append(
                    {
                        "question": question,
                        "answer": answer,
                    }
                )

            data[sheet_name] = questions

    return data


def write_output(data: dict[str, list[dict[str, str]]]) -> None:
    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    file_content = textwrap.dedent(
        f"""\
        window.BRAIN_QUIZ_DATA = {payload};
        """
    )
    OUTPUT_JS.write_text(file_content, encoding="utf-8")


def main() -> None:
    data = extract_questions()
    write_output(data)
    total = {name: len(items) for name, items in data.items()}
    print(json.dumps(total, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
