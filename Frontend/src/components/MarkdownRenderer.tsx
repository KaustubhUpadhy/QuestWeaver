import React from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Function to parse markdown-like formatting with improved list and bold handling
  const parseContent = (text: string) => {
    const elements: React.ReactNode[] = []
    
    // Split content into paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim())
    
    paragraphs.forEach((paragraph, paragraphIndex) => {
      // Check if this paragraph contains numbered lists
      const listMatch = paragraph.match(/^\d+\.\s/)
      
      if (listMatch) {
        // Handle numbered lists - split by number patterns
        const listItems = paragraph.split(/(?=\d+\.\s)/).filter(item => item.trim())
        
        elements.push(
          <ol key={`list-${paragraphIndex}`} className="list-decimal list-inside space-y-2 ml-4 my-4">
            {listItems.map((item, itemIndex) => {
              const cleanItem = item.replace(/^\d+\.\s/, '').trim()
              return (
                <li key={`item-${itemIndex}`} className="text-foreground leading-relaxed">
                  {parseInlineFormatting(cleanItem)}
                </li>
              )
            })}
          </ol>
        )
      } else {
        // Handle regular paragraphs with bold formatting
        const formattedParagraph = parseInlineFormatting(paragraph)
        elements.push(
          <div key={`para-${paragraphIndex}`} className="mb-4">
            {formattedParagraph}
          </div>
        )
      }
    })
    
    return elements
  }

  // Function to handle inline formatting (bold text and line breaks)
  const parseInlineFormatting = (text: string) => {
    // Split by bold patterns (**text**)
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove the asterisks and make it bold
        const boldText = part.slice(2, -2)
        
        // Check if this is a heading-like bold text (ends with :)
        if (boldText.endsWith(':')) {
          return (
            <React.Fragment key={index}>
              <strong className="font-bold text-primary text-lg block mb-2">
                {boldText}
              </strong>
              <br />
            </React.Fragment>
          )
        } else {
          return (
            <strong key={index} className="font-bold text-foreground">
              {boldText}
            </strong>
          )
        }
      }
      
      // Handle regular text with line breaks
      return part.split('\n').map((line, lineIndex, lines) => (
        <React.Fragment key={`${index}-${lineIndex}`}>
          {line}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      ))
    })
  }

  return (
    <div className={`text-left ${className}`}>
      {parseContent(content)}
    </div>
  )
}

export default MarkdownRenderer