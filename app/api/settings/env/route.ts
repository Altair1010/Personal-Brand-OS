import { NextRequest,NextResponse } from "next/server";
import { db } from "@/lib/db";
import { configureEnvPin,getEnvVault,saveEnvValues,verifyEnvPinAndCreateSession } from "@/lib/piltover/env-vault/service";
export const runtime="nodejs"; export const dynamic="force-dynamic";
function fail(error:unknown,status=400){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"ENV_VAULT_ERROR"},{status});}
export async function GET(req:NextRequest){try{return NextResponse.json({ok:true,data:await getEnvVault(db,req.headers.get("x-env-reveal-token")??undefined)});}catch(e){return fail(e,401);}}
export async function PUT(req:NextRequest){try{const b=await req.json();return NextResponse.json({ok:true,data:await saveEnvValues(db,b?.values??{})});}catch(e){return fail(e);}}
export async function POST(req:NextRequest){try{const b=await req.json();if(b?.action==="set-pin")return NextResponse.json({ok:true,data:await configureEnvPin(db,String(b.pin??""))});if(b?.action==="verify-pin")return NextResponse.json({ok:true,data:await verifyEnvPinAndCreateSession(db,String(b.pin??""))});return fail(new Error("ENV_ACTION_NOT_SUPPORTED"));}catch(e){return fail(e,e instanceof Error&&e.message==="ENV_PIN_LOCKED"?429:400);}}
