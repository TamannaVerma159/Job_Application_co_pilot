import os
from pypdf import PdfReader


def extract_text(file_path: str) -> str:
    """Extract plain text from a PDF or DOCX file."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".docx":
        return _extract_from_docx(file_path)
    else:
        return _extract_from_pdf(file_path)


def _extract_from_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text and text.strip():
                pages.append(text)
        return "\n".join(pages)
    except Exception as exc:
        raise ValueError(f"Could not parse PDF '{os.path.basename(file_path)}': {exc}") from exc


def _extract_from_docx(file_path: str) -> str:
    try:
        from docx import Document
        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception as exc:
        raise ValueError(f"Could not parse DOCX '{os.path.basename(file_path)}': {exc}") from exc
