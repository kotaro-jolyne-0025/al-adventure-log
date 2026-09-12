package com.dndadvlog.backend.service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

    @Value("${app.mail.from:onboarding@resend.dev}")
    private String mailFrom;

    @Value("${app.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    public void sendPasswordResetEmail(String toEmail, String displayName, String token, int expiryMinutes) {
        String resetUrl = frontendUrl + "/reset-password?token=" + token;

        log.info("================================================================================");
        log.info("📧 [密碼重設通知]");
        log.info("   收件者: {} ({})", displayName, toEmail);
        log.info("   重設連結: {}", resetUrl);
        log.info("   有效時間: {} 分鐘", expiryMinutes);
        log.info("================================================================================");

        if (mailSender == null || mailHost == null || mailHost.isBlank()) {
            log.info("ℹ️ 未設定 SMTP 郵件伺服器 (spring.mail.host 為空)，僅以 Log 印出重設連結。");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String fromAddress = (mailFrom != null && !mailFrom.isBlank()) ? mailFrom : "noreply@dndadvlog.internal";
            helper.setFrom(fromAddress, "D&D 冒險日誌系統");
            helper.setTo(toEmail);
            helper.setSubject("【D&D 冒險日誌】重設您的帳號密碼");

            String htmlContent = """
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #7b1fa2;">冒險者，您好！</h2>
                    <p>我們收到了您重設 <strong>D&D 冒險日誌</strong> 帳號密碼的請求。</p>
                    <p>請點擊下方按鈕以設定新密碼（此連結於 %d 分鐘內有效）：</p>
                    <div style="text-align: center; margin: 32px 0;">
                        <a href="%s" style="background-color: #7b1fa2; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                            重設我的密碼
                        </a>
                    </div>
                    <p style="color: #666; font-size: 13px;">若按鈕無法點擊，您也可以複製以下連結至瀏覽器開啟：<br><a href="%s">%s</a></p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                    <p style="color: #999; font-size: 12px;">如果您並未提出此申請，請忽略此郵件，您的密碼將維持不變。</p>
                </div>
            """.formatted(expiryMinutes, resetUrl, resetUrl, resetUrl);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("✅ 密碼重設信件已成功寄送至: {}", toEmail);
        } catch (Exception e) {
            log.error("❌ 寄送密碼重設郵件時發生錯誤 (Email: {}): {}", toEmail, e.getMessage());
        }
    }
}
