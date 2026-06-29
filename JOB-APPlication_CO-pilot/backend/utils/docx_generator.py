from docx import Document

def create_docx(content, filename):
    doc = Document()

    doc.add_paragraph(content)

    doc.save(filename)

    return filename