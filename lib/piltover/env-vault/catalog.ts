export type EnvField = {
  key: string;
  label: string;
  group: string;
  secret?: boolean;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
};

export const ENV_GROUPS = [
  "Meta App", "Business Manager", "Fanpage", "Ads Account", "Tracking & Conversion",
  "Instagram", "Messenger & Webhook", "Ads Safety", "Reporting",
] as const;

export const ENV_FIELDS: EnvField[] = [
  { key:"META_APP_ID", label:"Meta App ID", group:"Meta App", description:"ID ứng dụng Meta for Developers." },
  { key:"META_APP_SECRET", label:"Meta App Secret", group:"Meta App", secret:true, description:"Secret ứng dụng Meta." },
  { key:"META_API_VERSION", label:"Graph API Version", group:"Meta App", defaultValue:"v23.0" },
  { key:"META_BUSINESS_ID", label:"Business ID", group:"Business Manager" },
  { key:"META_SYSTEM_USER_ID", label:"System User ID", group:"Business Manager" },
  { key:"META_SYSTEM_USER_ACCESS_TOKEN", label:"System User Access Token", group:"Business Manager", secret:true },
  { key:"META_PAGE_NAME", label:"Page Name", group:"Fanpage" },
  { key:"META_PAGE_ID", label:"Page ID", group:"Fanpage" },
  { key:"META_PAGE_ACCESS_TOKEN", label:"Page Access Token", group:"Fanpage", secret:true },
  { key:"META_AD_ACCOUNT_NAME", label:"Ad Account Name", group:"Ads Account" },
  { key:"META_AD_ACCOUNT_ID", label:"Ad Account ID", group:"Ads Account", placeholder:"act_" },
  { key:"META_CURRENCY", label:"Currency", group:"Ads Account", defaultValue:"VND" },
  { key:"META_TIMEZONE", label:"Timezone", group:"Ads Account", defaultValue:"Asia/Ho_Chi_Minh" },
  { key:"META_PIXEL_ID", label:"Pixel ID", group:"Tracking & Conversion" },
  { key:"META_DATASET_ID", label:"Dataset ID", group:"Tracking & Conversion" },
  { key:"META_CONVERSION_EVENT", label:"Conversion Event", group:"Tracking & Conversion", defaultValue:"Purchase" },
  { key:"META_CUSTOM_CONVERSION_ID", label:"Custom Conversion ID", group:"Tracking & Conversion" },
  { key:"META_CAPI_ACCESS_TOKEN", label:"CAPI Access Token", group:"Tracking & Conversion", secret:true },
  { key:"META_TEST_EVENT_CODE", label:"Test Event Code", group:"Tracking & Conversion", secret:true, description:"Chỉ dùng khi kiểm thử; xóa khỏi production khi không cần." },
  { key:"META_INSTAGRAM_ACCOUNT_ID", label:"Instagram Account ID", group:"Instagram" },
  { key:"META_INSTAGRAM_USERNAME", label:"Instagram Username", group:"Instagram" },
  { key:"META_WEBHOOK_VERIFY_TOKEN", label:"Webhook Verify Token", group:"Messenger & Webhook", secret:true },
  { key:"META_WEBHOOK_CALLBACK_URL", label:"Webhook Callback URL", group:"Messenger & Webhook" },
  { key:"META_WEBHOOK_APP_SECRET", label:"Webhook App Secret", group:"Messenger & Webhook", secret:true },
  { key:"ADS_REQUIRE_APPROVAL", label:"Require Approval", group:"Ads Safety", defaultValue:"true", description:"Agent phải trình preview và chờ phê duyệt trước thao tác Ads." },
  { key:"ADS_DEFAULT_DAILY_BUDGET_VND", label:"Default Daily Budget", group:"Ads Safety" },
  { key:"ADS_MAX_DAILY_BUDGET_VND", label:"Max Daily Budget", group:"Ads Safety" },
  { key:"ADS_MAX_CAMPAIGN_BUDGET_VND", label:"Max Campaign Budget", group:"Ads Safety" },
  { key:"ADS_DEFAULT_OBJECTIVE", label:"Default Objective", group:"Ads Safety", defaultValue:"OUTCOME_ENGAGEMENT" },
  { key:"ADS_DEFAULT_DESTINATION", label:"Default Destination", group:"Ads Safety", defaultValue:"MESSENGER" },
  { key:"ADS_DEFAULT_COUNTRY", label:"Default Country", group:"Ads Safety", defaultValue:"VN" },
  { key:"ADS_DEFAULT_LANGUAGE", label:"Default Language", group:"Ads Safety", defaultValue:"vi" },
  { key:"ADS_REPORT_TIMEZONE", label:"Report Timezone", group:"Ads Safety", defaultValue:"Asia/Ho_Chi_Minh" },
  { key:"ADS_REPORT_SHEET_ID", label:"Report Sheet ID", group:"Reporting" },
  { key:"ADS_REPORT_SHEET_NAME", label:"Report Sheet Name", group:"Reporting", defaultValue:"BÁO CÁO ADS META" },
  { key:"ADS_REPORT_START_DATE", label:"Report Start Date", group:"Reporting" },
  { key:"ADS_REPORT_RECIPIENT_CHAT_ID", label:"Telegram Recipient Chat ID", group:"Reporting", secret:true },
];

export const DYNAMIC_KEY = /^(META_PAGE_\d{2}_(NAME|ID|ACCESS_TOKEN)|META_AD_ACCOUNT_\d{2}_(NAME|ID))$/;
export function isSecretKey(key:string) {
  return ENV_FIELDS.find((f)=>f.key===key)?.secret === true || /(_SECRET|_TOKEN|CHAT_ID)$/.test(key);
}
export function isAllowedEnvKey(key:string) {
  return ENV_FIELDS.some((f)=>f.key===key) || DYNAMIC_KEY.test(key);
}
export function dynamicField(key:string): EnvField {
  const page=key.match(/^META_PAGE_(\d{2})_(NAME|ID|ACCESS_TOKEN)$/);
  if(page) return {key,label:`Page ${page[1]} ${page[2].replaceAll("_"," ")}`,group:"Fanpage",secret:page[2]==="ACCESS_TOKEN"};
  const ad=key.match(/^META_AD_ACCOUNT_(\d{2})_(NAME|ID)$/);
  return {key,label:`Ad Account ${ad?.[1]} ${ad?.[2]}`,group:"Ads Account"};
}
