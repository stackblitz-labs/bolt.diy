import JSZip from 'jszip';

/*
 * Flag to use only fallback method
 * const USE_ONLY_FALLBACK = true;
 */

/**
 * Extracts text from a DOCX file
 *
 * @param file The DOCX file
 * @returns A Promise with the extracted text
 */
export async function extractTextFromDOCX(file: File | Blob): Promise<string> {
  try {
    // Load the file as a zip
    const zip = new JSZip();
    const content = await zip.loadAsync(file);

    // The main content of the document is in word/document.xml
    const documentXml = await content.file('word/document.xml')?.async('text');

    if (!documentXml) {
      throw new Error('document.xml not found in DOCX file');
    }

    /*
     * Extract text using regular expressions
     * This is a simplification and may not capture all the complexities
     * of a DOCX document, but it works for simple cases
     */
    const textMatches = documentXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);

    if (!textMatches) {
      return 'No text content found in document';
    }

    // Extract the text from each <w:t> tag
    const extractedText = textMatches
      .map((match) => {
        // Extract the content between <w:t> and </w:t>
        const content = match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1');
        return content;
      })
      .join(' ');

    return extractedText;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    return `Error extracting text: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Extracts text from PDF using a simplified method that doesn't depend on the worker
 * This function analyzes the raw bytes of the PDF to find text strings
 */
async function extractPdfTextSimple(file: File | Blob): Promise<string> {
  try {
    // Read the file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Convert to string
    const textDecoder = new TextDecoder('utf-8');
    const pdfString = textDecoder.decode(data);

    /*
     * Look for common text patterns in PDFs
     * PDF uses parentheses () to delimit strings in many cases
     */
    const textChunks = [];

    // Search for text between parentheses - common in PDFs
    const parenthesesMatches = pdfString.match(/\(([^\(\)\\]*(?:\\.[^\(\)\\]*)*)\)/g) || [];

    for (const match of parenthesesMatches) {
      // Remove parentheses and decode escape sequences
      const processed = match
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');

      // If it looks like valid text (more than just special characters)
      if (/[a-zA-Z0-9]{2,}/.test(processed)) {
        textChunks.push(processed);
      }
    }

    /*
     * Search for uncompressed text blocks
     * Many PDFs have text between /BT and /ET
     */
    const btEtRegex = /BT[\s\S]+?ET/g;
    const textBlocks = pdfString.match(btEtRegex) || [];

    for (const block of textBlocks) {
      // Extract TJ strings within BT/ET blocks that frequently contain text
      const tjMatches = block.match(/\[([^\]]+)\][\s]*TJ/g) || [];

      for (const tj of tjMatches) {
        // Extract strings within parentheses
        const stringMatches = tj.match(/\(([^\(\)\\]*(?:\\.[^\(\)\\]*)*)\)/g) || [];

        for (const str of stringMatches) {
          const processed = str
            .slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');

          if (processed.trim().length > 0) {
            textChunks.push(processed);
          }
        }
      }

      // Extract Tj strings that also contain text
      const tjSingleMatches = block.match(/\(([^\(\)\\]*(?:\\.[^\(\)\\]*)*)\)[\s]*Tj/g) || [];

      for (const tj of tjSingleMatches) {
        const processed = tj
          .match(/\(([^\(\)\\]*(?:\\.[^\(\)\\]*)*)\)/)?.[0]
          ?.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');

        if (processed && processed.trim().length > 0) {
          textChunks.push(processed);
        }
      }
    }

    // Join and clean the extracted text
    if (textChunks.length === 0) {
      return 'No text could be extracted from this PDF. The file may be scanned, protected, or corrupt.';
    }

    // Process and join the text chunks
    let extractedText = '';
    let currentLine = '';

    // const lastY = null;

    // Sort and group by lines (simulating layout)
    for (const chunk of textChunks) {
      // Add chunk, preserving line breaks
      if (chunk.includes('\n')) {
        // If it contains line breaks, split
        const lines = chunk.split('\n');
        currentLine += lines[0].trim() + ' ';

        for (let i = 1; i < lines.length; i++) {
          if (currentLine.trim().length > 0) {
            extractedText += currentLine.trim() + '\n';
          }

          currentLine = lines[i].trim() + ' ';
        }
      } else {
        // Add to current text
        currentLine += chunk.trim() + ' ';

        // If the chunk appears to be the end of a sentence, add a line break
        if (chunk.trim().match(/[.!?]$/)) {
          extractedText += currentLine.trim() + '\n';
          currentLine = '';
        }
      }
    }

    // Add the last line if there is remaining content
    if (currentLine.trim().length > 0) {
      extractedText += currentLine.trim();
    }

    // Clean and format
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\n\s+/g, '\n') // Remove spaces at the beginning of lines
      .replace(/\n+/g, '\n\n') // Normalize line breaks
      .trim();

    return extractedText || 'Limited text was extracted from this PDF. It may be primarily a scanned document.';
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return `Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Extracts text from a PDF file using a simplified method
 * that doesn't depend on the pdfjs-dist library
 *
 * @param file The PDF file
 * @returns A Promise with the extracted text
 */
export async function extractTextFromPDF(file: File | Blob): Promise<string> {
  console.log('Extracting text from PDF using simplified method');

  // Use the simplified method that doesn't depend on external libraries
  return extractPdfTextSimple(file);
}

/**
 * Detects the document type and extracts the text
 *
 * @param file The file (DOCX, PDF, etc.)
 * @returns A Promise with the extracted text
 */
export async function extractTextFromDocument(file: File | Blob): Promise<string> {
  const fileType = file instanceof File ? file.type : '';
  const fileName = file instanceof File ? file.name.toLowerCase() : '';

  try {
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      return await extractTextFromDOCX(file);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await extractTextFromPDF(file);
    } else {
      return 'Unsupported document type. Please upload DOCX or PDF files.';
    }
  } catch (error) {
    console.error('Document extraction error:', error);
    return `Document processing error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
