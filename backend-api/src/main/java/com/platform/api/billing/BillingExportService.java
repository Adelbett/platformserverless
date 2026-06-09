package com.platform.api.billing;

import com.platform.api.billing.dto.BillingHistoryResponse;
import com.platform.api.kafka.KafkaTopic;
import com.platform.api.kafka.KafkaTopicRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BillingExportService {

    private final BillingService billingService;
    private final KafkaTopicRepository kafkaTopicRepository;

    private static final double CPU_PRICE  = BillingService.CPU_PER_VCPU_HOUR;
    private static final double MEM_PRICE  = BillingService.MEM_PER_GB_HOUR;
    private static final double KAFKA_PRICE = 2.00;

    public byte[] exportExcel(String userId) throws IOException {
        BillingHistoryResponse billing = billingService.getMyBilling(userId);
        List<KafkaTopic> topics = kafkaTopicRepository.findByUserId(userId);

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = makeHeaderStyle(wb);
            CellStyle moneyStyle  = makeMoneyStyle(wb);
            CellStyle titleStyle  = makeTitleStyle(wb);

            buildSummarySheet(wb, billing, topics, headerStyle, moneyStyle, titleStyle);
            buildServicesSheet(wb, billing, headerStyle, moneyStyle, titleStyle);
            buildKafkaSheet(wb, topics, headerStyle, moneyStyle, titleStyle);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── Sheet 1: Monthly Summary ─────────────────────────────────────────────────
    private void buildSummarySheet(XSSFWorkbook wb, BillingHistoryResponse b,
                                   List<KafkaTopic> topics,
                                   CellStyle header, CellStyle money, CellStyle title) {
        Sheet sheet = wb.createSheet("Summary");
        sheet.setColumnWidth(0, 9000);
        sheet.setColumnWidth(1, 5000);

        int row = 0;
        row = writeTitle(sheet, row, "Monthly Billing Summary — " +
                LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM yyyy")), title);

        row = writeLabelValue(sheet, row, "Month to Date (MTD)",    fmt(b.getMtdCost()), money);
        row = writeLabelValue(sheet, row, "Projected End of Month", fmt(b.getProjectedMonthly()), money);
        row = writeLabelValue(sheet, row, "Current Rate",           fmt(b.getHourlyRate()) + " / hour", null);
        row = writeLabelValue(sheet, row, "Active Services",        String.valueOf(
                b.getPerApp().stream().filter(a -> !a.isDeleted()).count()), null);
        row = writeLabelValue(sheet, row, "Deleted Services (history kept)",
                String.valueOf(b.getPerApp().stream().filter(BillingHistoryResponse.AppCostEntry::isDeleted).count()), null);
        row = writeLabelValue(sheet, row, "Kafka Topics",           String.valueOf(topics.size()), null);

        row++;
        row = writeTitle(sheet, row, "Pricing", title);
        row = writeLabelValue(sheet, row, "vCPU",        "$" + CPU_PRICE  + " / vCPU-hour", null);
        row = writeLabelValue(sheet, row, "RAM",         "$" + MEM_PRICE  + " / GiB-hour",  null);
        row = writeLabelValue(sheet, row, "Kafka topic", "$" + KAFKA_PRICE + " / topic / month", null);
        row = writeLabelValue(sheet, row, "Scale-to-zero idle billing", "20% of allocated rate", null);
    }

    // ── Sheet 2: Per Service ─────────────────────────────────────────────────────
    private void buildServicesSheet(XSSFWorkbook wb, BillingHistoryResponse b,
                                    CellStyle header, CellStyle money, CellStyle title) {
        Sheet sheet = wb.createSheet("Services");
        int[] widths = {8000, 6000, 4000, 4000, 4000, 5000, 5000};
        for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i]);

        int row = 0;
        row = writeTitle(sheet, row, "Per Service Breakdown", title);

        String[] cols = {"Service Name", "Namespace", "Status", "MTD Cost ($)", "Projected/mo ($)", "CPU Cost", "Mem Cost"};
        writeHeaderRow(sheet, row++, cols, header);

        for (BillingHistoryResponse.AppCostEntry e : b.getPerApp()) {
            Row r = sheet.createRow(row++);
            r.createCell(0).setCellValue(e.getServiceName() + (e.isDeleted() ? " [DELETED]" : ""));
            r.createCell(1).setCellValue(e.getNamespace());
            r.createCell(2).setCellValue(e.isDeleted() ? "DELETED" : "ACTIVE");
            Cell c3 = r.createCell(3); c3.setCellValue(e.getMtdCost()); c3.setCellStyle(money);
            Cell c4 = r.createCell(4); c4.setCellValue(e.getProjectedMonthly()); c4.setCellStyle(money);
            r.createCell(5).setCellValue("—");
            r.createCell(6).setCellValue("—");
        }

        // Total row
        Row total = sheet.createRow(row);
        total.createCell(0).setCellValue("TOTAL");
        Cell tc = total.createCell(3);
        tc.setCellValue(b.getMtdCost());
        tc.setCellStyle(money);
    }

    // ── Sheet 3: Kafka ───────────────────────────────────────────────────────────
    private void buildKafkaSheet(XSSFWorkbook wb, List<KafkaTopic> topics,
                                 CellStyle header, CellStyle money, CellStyle title) {
        Sheet sheet = wb.createSheet("Kafka Topics");
        sheet.setColumnWidth(0, 8000);
        sheet.setColumnWidth(1, 4000);
        sheet.setColumnWidth(2, 4000);

        int row = 0;
        row = writeTitle(sheet, row, "Kafka Topics", title);
        writeHeaderRow(sheet, row++, new String[]{"Topic Name", "Partitions", "Cost/month ($)"}, header);

        for (KafkaTopic t : topics) {
            Row r = sheet.createRow(row++);
            r.createCell(0).setCellValue(t.getName());
            r.createCell(1).setCellValue(t.getPartitions() != null ? t.getPartitions() : 1);
            Cell c = r.createCell(2); c.setCellValue(KAFKA_PRICE); c.setCellStyle(money);
        }

        Row total = sheet.createRow(row);
        total.createCell(0).setCellValue("TOTAL");
        Cell tc = total.createCell(2);
        tc.setCellValue(topics.size() * KAFKA_PRICE);
        tc.setCellStyle(money);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private int writeTitle(Sheet sheet, int rowIdx, String text, CellStyle style) {
        Row r = sheet.createRow(rowIdx);
        Cell c = r.createCell(0);
        c.setCellValue(text);
        c.setCellStyle(style);
        sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 6));
        return rowIdx + 1;
    }

    private int writeLabelValue(Sheet sheet, int rowIdx, String label, String value, CellStyle valueStyle) {
        Row r = sheet.createRow(rowIdx);
        r.createCell(0).setCellValue(label);
        Cell vc = r.createCell(1);
        vc.setCellValue(value);
        if (valueStyle != null) vc.setCellStyle(valueStyle);
        return rowIdx + 1;
    }

    private void writeHeaderRow(Sheet sheet, int rowIdx, String[] cols, CellStyle style) {
        Row r = sheet.createRow(rowIdx);
        for (int i = 0; i < cols.length; i++) {
            Cell c = r.createCell(i);
            c.setCellValue(cols[i]);
            c.setCellStyle(style);
        }
    }

    private String fmt(double v) { return String.format("$%.4f", v); }

    private CellStyle makeHeaderStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setColor(IndexedColors.WHITE.getIndex());
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setBorderBottom(BorderStyle.THIN);
        return s;
    }

    private CellStyle makeMoneyStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        DataFormat fmt = wb.createDataFormat();
        s.setDataFormat(fmt.getFormat("$#,##0.0000"));
        return s;
    }

    private CellStyle makeTitleStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 13);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }
}
