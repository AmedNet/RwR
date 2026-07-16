// src/core/VehicleRegistry.js
// 载具注册表

export const VehicleRegistry = {
    jeep: {
        id: "jeep",
        name: "军用吉普",
        type: "transport",
        health: 350,
        armor: 0.5,
        windshieldHealth: 80,
        windshieldDamageReduction: 0.08,
        speed: 7.0,
        radius: 72,
        mountRange: 90,
        passengers: 3,
        passengerRange: 120,
        drawScale: 0.28,
        acceleration: 0.12,
        brakeDeceleration: 0.28,
        friction: 0.965,
        reverseSpeedRatio: 0.55,
        turnRate: 0.045,
        impactDamage: 45,
        impactCooldown: 30,
        color: "#5C4033",
        strokeColor: "#3E2723",
        width: 74,
        height: 160,
    }
};
