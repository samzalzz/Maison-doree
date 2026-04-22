import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import PDFDocument from 'pdfkit'

type RouteContext = { params?: Record<string, string | string[]> }

export const GET = withAdminAuth(async (req: NextRequest, { params }: RouteContext) => {
  const id = params?.id as string | undefined
  if (!id) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found.' } },
      { status: 404 },
    )
  }

  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, email: true, phone: true, address: true, city: true } },
        items: {
          include: {
            material: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    })

    if (!po) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found.' } },
        { status: 404 },
      )
    }

    // Create PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 40 })

    // Prepare response
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('PURCHASE ORDER', { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).font('Helvetica').text(`PO Number: ${po.poNumber}`, { align: 'center' })
    doc.text(`Date: ${new Date(po.createdAt).toLocaleDateString()}`, { align: 'center' })
    doc.text(`Status: ${po.status.toUpperCase()}`, { align: 'center' })

    doc.moveDown(1.5)

    // Supplier info
    doc.fontSize(12).font('Helvetica-Bold').text('SUPPLIER INFORMATION')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Name: ${po.supplier.name}`)
    if (po.supplier.email) doc.text(`Email: ${po.supplier.email}`)
    if (po.supplier.phone) doc.text(`Phone: ${po.supplier.phone}`)
    if (po.supplier.address) doc.text(`Address: ${po.supplier.address}`)
    if (po.supplier.city) doc.text(`City: ${po.supplier.city}`)

    doc.moveDown(1.5)

    // Delivery info
    doc.fontSize(12).font('Helvetica-Bold').text('DELIVERY DETAILS')
    doc.fontSize(10).font('Helvetica')
    doc.text(`Expected Delivery: ${new Date(po.deliveryDate).toLocaleDateString()}`)
    if (po.deliveredAt) doc.text(`Delivered: ${new Date(po.deliveredAt).toLocaleDateString()}`)

    doc.moveDown(1.5)

    // Line items table
    doc.fontSize(12).font('Helvetica-Bold').text('LINE ITEMS')
    doc.moveDown(0.5)

    // Table header
    const startX = 40
    const col1X = startX
    const col2X = col1X + 250
    const col3X = col2X + 80
    const col4X = col3X + 80
    const col5X = col4X + 100

    doc.fontSize(9).font('Helvetica-Bold')
    doc.text('Material', col1X, doc.y, { width: 250 })
    doc.text('Qty', col2X, doc.y - doc.currentLineHeight(), { width: 80 })
    doc.text('Unit', col3X, doc.y - doc.currentLineHeight(), { width: 80 })
    doc.text('Unit Price', col4X, doc.y - doc.currentLineHeight(), { width: 100 })
    doc.text('Line Total', col5X, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' })

    doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.5)

    // Line items
    doc.fontSize(9).font('Helvetica')
    let subtotal = 0

    for (const item of po.items) {
      const lineTotal = Number(item.lineTotal || 0)
      subtotal += lineTotal

      doc.text(item.material.name, col1X, doc.y, { width: 250 })
      doc.text(Number(item.quantity).toFixed(2), col2X, doc.y - doc.currentLineHeight(), { width: 80 })
      doc.text(item.material.unit, col3X, doc.y - doc.currentLineHeight(), { width: 80 })
      doc.text(`${Number(item.unitPrice).toFixed(4)}`, col4X, doc.y - doc.currentLineHeight(), { width: 100 })
      doc.text(`${lineTotal.toFixed(2)} DH`, col5X, doc.y - doc.currentLineHeight(), { width: 100, align: 'right' })

      doc.moveDown(0.8)
    }

    doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.5)

    // Total
    doc.fontSize(11).font('Helvetica-Bold')
    doc.text(`TOTAL: ${subtotal.toFixed(2)} DH`, { align: 'right' })

    // Finalize PDF
    doc.end()

    // Wait for PDF to finish and return
    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)
        resolve(
          new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="PO-${po.poNumber}.pdf"`,
            },
          }),
        )
      })
    })
  } catch (error) {
    console.error('[purchase-orders/[id]/pdf] Error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to generate PDF.' } },
      { status: 500 },
    )
  }
})
