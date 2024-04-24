use actix_web::web::Json;
use actix_web::Error;
use apistos::actix::CreatedJson;
use apistos::{api_operation, ApiComponent };
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, JsonSchema, ApiComponent)]
pub struct HealthResponse {
    pub message: String,
}

#[derive(Deserialize, Serialize, JsonSchema, ApiComponent)]
pub struct WebhookCallback {
    pub reference_id: String,
    pub address: String,
    pub msa_id: String,
    pub handle: String,
}

#[derive(Serialize, JsonSchema, ApiComponent)]
pub struct EchoPayload {
    pub reference_id: String,
    pub address: String,
    pub msa_id: String,
    pub handle: String,
}

#[api_operation(
    tag = "webhook",
    summary = "Echo payload",
    description = "Echoes the payload back to the client",
    error_code = 400,
)]
pub(crate) async fn echo_payload(body: Json<WebhookCallback>) -> Result<CreatedJson<EchoPayload>, Error> {
    println!("Received payload: {}", serde_json::to_string_pretty(&body).unwrap());
    let callback_msg = body.into_inner();
    let payload = EchoPayload {
        reference_id: callback_msg.reference_id,
        address: callback_msg.address,
        msa_id: callback_msg.msa_id,
        handle: callback_msg.handle,
    };
    Ok(CreatedJson(payload))
}

#[api_operation(summary = "Health check")]
pub(crate) async fn health_check() -> Result<Json<HealthResponse>, Error> {
    println!("Health check");
    Ok(Json(HealthResponse {
        message: "Server is healthy".to_string(),
    }))
}



