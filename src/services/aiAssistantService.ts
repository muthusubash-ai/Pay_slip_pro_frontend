import api from './api';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export async function sendChatMessage(message: string, priorMessages: ChatMessage[] = []): Promise<string> {
  try {
    // Prior turns of the conversation, oldest first, so the assistant remembers what
    // was already asked/answered instead of treating every message as a fresh chat.
    const history = priorMessages
      .slice(-20)
      .map((m) => ({ role: m.sender, content: m.text }));
    const response = await api.post<{ reply: string }>('/ai-assistant/chat', {
      message: message.trim(),
      history,
    });
    if (response.data && response.data.reply) {
      return response.data.reply;
    }
  } catch (err: unknown) {
    // If backend returns a structured detail message, check if it has info
    const axiosErr = err as { response?: { status?: number; data?: { detail?: string; reply?: string; code?: string } } };
    if (axiosErr?.response?.data?.reply) {
      return axiosErr.response.data.reply;
    }
    // Plan restriction (Starter/free tier) - surface the real reason instead of a
    // generic canned fallback, which would make the upgrade requirement invisible.
    if (axiosErr?.response?.status === 403 || axiosErr?.response?.data?.code === 'FORBIDDEN') {
      return (
        `🔒 ${axiosErr.response.data?.detail || 'AI Assistant requires the Professional plan or higher.'}\n\n` +
        'Upgrade your plan from **Settings → Plans & Billing** to unlock the AI Assistant.'
      );
    }
    // If network or upstream issue, fall back to responsive smart assistance
  }

  // Frontend intelligent fallback if backend API is temporarily offline
  const lower = message.trim().toLowerCase();

  if (lower.includes('net pay') || lower.includes('salary') || lower.includes('calculate')) {
    return (
      "💰 **How Salary & Net Pay is Calculated:**\n\n" +
      "1. **Gross Salary** = Basic Salary + Allowances (HRA, DA, Conveyance).\n" +
      "2. **Daily Rate** = Basic Salary ÷ Total Days in Month.\n" +
      "3. **Leave Deduction** = Unpaid Leaves × Daily Rate.\n" +
      "4. **Statutory Deductions** = PF (12%) + ESI (0.75%) + Professional Tax.\n" +
      "5. **Net Pay** = Gross Salary − Leave Deduction − Statutory Deductions.\n\n" +
      "You can review each employee's detailed breakdown under **Salary Slips**."
    );
  }

  if (lower.includes('leave') || lower.includes('attendance') || lower.includes('punch') || lower.includes('biometric')) {
    return (
      "📅 **Attendance & Leave Rules:**\n\n" +
      "• Employees can punch in/out using camera face recognition or employee invite code at `/biometric`.\n" +
      "• Attendance statuses include: **Present**, **Half Day**, **Leave**, **Permission**, and **Company Week Off**.\n" +
      "• Approved permissions up to your company limit carry zero salary deduction.\n" +
      "• Monthly attendance is automatically synced for payroll calculations."
    );
  }

  if (lower.includes('slip') || lower.includes('payslip') || lower.includes('generate') || lower.includes('pdf')) {
    return (
      "📄 **Generating & Sending Salary Slips:**\n\n" +
      "1. Go to **Salary Slips → Generate Slips** from the left sidebar.\n" +
      "2. Select the Month and Year for the payroll cycle.\n" +
      "3. Choose employees and click **Generate**.\n" +
      "4. Click **Download PDF** for a printable slip, or **Email Slip** to dispatch directly to the employee."
    );
  }

  if (lower.includes('employee') || lower.includes('add employee') || lower.includes('onboard')) {
    return (
      "👥 **Employee Management:**\n\n" +
      "• View and manage all staff from the **Employees** menu.\n" +
      "• Click **Add Employee** to onboard new team members with salary, bank IFSC, and biometric face registration.\n" +
      "• Send biometric onboarding invite links directly to their WhatsApp or email from the employee details page."
    );
  }

  return (
    "👋 I'm your **Zigmaa AI Assistant**!\n\n" +
    "I can help you with:\n" +
    "• Employee payroll, basic pay, and deduction calculations\n" +
    "• Biometric face scan attendance & leave tracking\n" +
    "• Generating and emailing monthly salary slips\n" +
    "• Company policies and compliance\n\n" +
    "Feel free to ask a specific question!"
  );
}
