use napi_derive::napi;
use rsdk_core;

#[napi]
pub fn check_rsdk_status() -> String {
    rsdk_core::get_status()
}

#[napi]
pub async fn heavy_compute(input: i32) -> i32 {
    input * 2
}
