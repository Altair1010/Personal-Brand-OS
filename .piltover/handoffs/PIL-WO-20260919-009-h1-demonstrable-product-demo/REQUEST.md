# PIL-WO-20260919-009-h1-demonstrable-product-demo

Status: IN_PROGRESS
Horizon: H1 — Demonstrable / Product Demo
Base ref: `f641c740e17f8920b556416731fcbc4f1973fef0`
Branch: `work/PIL-H1-demonstrable-product-demo`

## Objective

Produce the first end-to-end Piltover product demo from the current P5 baseline by prioritizing a vertical product outcome over phase completion.

The implementation must preserve the existing Piltover architecture and safety invariants, while allowing the engineering route to be selected adaptively under AMH v0.3 Partial.

## Delivery philosophy

Use AMH v0.3 Partial as the control kernel. Overlay an experimental, unnamed vertical-product-outcome philosophy:

- global outcome before local phase completion;
- local work counts as progress only when it creates user-visible outcome delta or protects a material invariant;
- architecture is preserved where already proven, but implementation order is not dictated by the old P0→P13 sequence;
- parallelize bounded discovery/evidence, serialize consequential mutation;
- stop H1 when the demonstrable product outcome is sufficiently proven.

This overlay is not promoted as a new method or AMH version in this work order.
