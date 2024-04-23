use crate::api::{echo_payload, health_check};
use actix_web::middleware::Logger;
use actix_web::{App, HttpServer};
use apistos::app::OpenApiWrapper;
use apistos::info::Info;
use apistos::server::Server;
use apistos::spec::Spec;
use actix_web::web::{get, post, resource, scope};
use std::error::Error;
use std::net::Ipv4Addr;

mod api;

#[actix_web::main]
async fn main() -> Result<(), impl Error> {
    const HOST: Ipv4Addr = Ipv4Addr::new(127, 0, 0, 1);
    const PORT: u16 = 5555;
    println!("Starting Webhook Server on http://{}:{}", HOST, PORT);
    HttpServer::new(|| {
        // let spec = Spec {
        //     info: Info {
        //         title: "Webhook Server".to_string(),
        //         version: "1.0".to_string(),
        //         description: Some("A simple webhook server".to_string()),
        //         ..Default::default()
        //     },
        //     servers: vec![Server {
        //         url: "/api/v3".to_string(),
        //         ..Default::default()
        //     }],
        //     ..Default::default()
        // };

        App::new()
            .route("webhook", post().to(echo_payload))
            .route("health", get().to(health_check))
    })
    .bind((HOST, PORT))?
    .run()
    .await
}
