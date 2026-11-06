/**
 * n8n Candidate Onboarding Automation Service
 * Handles secure webhook dispatch to n8n workflow for Kodewar LMS
 * Designed for high reliability in Vercel Serverless Production environments.
 */

export interface CandidateOnboardingPayload {
  eventType: 'candidate_created' | 'resend_activation';
  userName: string;
  userEmail: string;
  userCourse: string;
  tempPassword: string;
  candidateId: string;
  enrollmentDate?: string;
  adminEmail?: string;
  loginUrl?: string;
}

export interface N8nTriggerResult {
  triggered: boolean;
  success: boolean;
  message: string;
  statusCode?: number;
  data?: any;
}

/**
 * Dispatches candidate onboarding payload to the configured n8n Webhook URL.
 * Includes timeout protection and error shielding so Vercel Serverless
 * operations never crash if n8n is offline or unreachable.
 */
export async function triggerN8nCandidateOnboarding(
  payload: CandidateOnboardingPayload
): Promise<N8nTriggerResult> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
  const defaultAppUrl = process.env.APP_URL?.trim() || 'https://kodewar.vercel.app';

  if (!webhookUrl) {
    console.warn(
      '[n8n Automation]: N8N_WEBHOOK_URL is not set in environment variables. ' +
        'Candidate saved, but automated onboarding email trigger was skipped.'
    );
    return {
      triggered: false,
      success: false,
      message: 'N8N_WEBHOOK_URL environment variable is not configured on Vercel.',
    };
  }

  // Detect common configuration mistakes on Vercel Production
  if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
    const errorMsg =
      `Invalid Webhook URL: "${webhookUrl}". Vercel is running in the cloud and cannot reach "localhost" on your computer. ` +
      `Please expose your local n8n using ngrok (e.g. "npx ngrok http 5678") or use a hosted n8n instance, then update N8N_WEBHOOK_URL on Vercel.`;
    console.error(`[n8n Automation Config Error]: ${errorMsg}`);
    return {
      triggered: false,
      success: false,
      message: errorMsg,
    };
  }

  if (webhookUrl.includes('your-n8n-instance.com') || webhookUrl.includes('example.com')) {
    const errorMsg =
      `N8N_WEBHOOK_URL is still set to the documentation placeholder "${webhookUrl}". ` +
      `Please replace it with your actual n8n webhook URL in your Vercel Environment Variables and redeploy.`;
    console.error(`[n8n Automation Config Error]: ${errorMsg}`);
    return {
      triggered: false,
      success: false,
      message: errorMsg,
    };
  }

  const normalizedPayload = {
    // Exact placeholder keys requested
    event_type: payload.eventType,
    user_name: payload.userName,
    user_course: payload.userCourse,
    user_email: payload.userEmail,
    temp_password: payload.tempPassword,
    candidate_id: payload.candidateId,
    login_url: payload.loginUrl || `${defaultAppUrl}/login`,
    enrollment_date: payload.enrollmentDate || new Date().toISOString().split('T')[0],
    admin_email: payload.adminEmail || 'admin@kodewar.com',
    timestamp: new Date().toISOString(),

    // CamelCase variants for maximum compatibility
    userName: payload.userName,
    userCourse: payload.userCourse,
    userEmail: payload.userEmail,
    tempPassword: payload.tempPassword,
    candidateId: payload.candidateId,
  };

  const controller = new AbortController();
  // 8 second safety timeout for Vercel Serverless execution
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Kodewar-LMS-Vercel/1.0',
    };

    if (webhookSecret) {
      headers['x-webhook-secret'] = webhookSecret;
      headers['Authorization'] = `Bearer ${webhookSecret}`;
    }

    console.log(
      `[n8n Automation]: Triggering webhook (${payload.eventType}) for ${payload.userEmail} at ${webhookUrl}...`
    );

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(normalizedPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let responseData: any = null;
    const responseText = await response.text();
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      console.log(
        `[n8n Automation Success]: Webhook response (${response.status}) for ${payload.userEmail}:`,
        responseData
      );
      return {
        triggered: true,
        success: true,
        statusCode: response.status,
        message: 'n8n onboarding email automation triggered successfully.',
        data: responseData,
      };
    } else {
      console.error(
        `[n8n Automation Error]: Webhook responded with status ${response.status}:`,
        responseText
      );
      return {
        triggered: true,
        success: false,
        statusCode: response.status,
        message: `n8n webhook returned status ${response.status}: ${responseText.slice(0, 200)}`,
        data: responseData,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err.name === 'AbortError';
    const causeDetail = err.cause
      ? ` (${err.cause.code || err.cause.message || JSON.stringify(err.cause)})`
      : '';
    const errorMsg = isAbort
      ? 'n8n webhook request timed out after 8000ms.'
      : `${err.message || 'Unknown network error'}${causeDetail}`;

    console.error(`[n8n Automation Network Failure]: ${errorMsg}`);

    let hint = '';
    if (errorMsg.includes('fetch failed')) {
      hint = ' Ensure your n8n instance is publicly accessible, running, and the workflow is Active.';
    }

    return {
      triggered: true,
      success: false,
      message: `Failed to dispatch to n8n webhook: ${errorMsg}.${hint}`,
    };
  }
}

