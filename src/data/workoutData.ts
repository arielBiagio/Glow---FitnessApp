import type { WorkoutDay, WeeklyScheduleItem, ScienceFactor } from '../types';

export const workoutData: WorkoutDay[] = [
  {
    id: "dia-a",
    name: "Día A",
    subtitle: "Glúteo + Isquios",
    tag: "Hip thrust dominante",
    summary: {
      warmup: 8,
      main: 48,
      cooldown: 9,
      total: 65
    },
    sections: [
      {
        title: "Calentamiento — activación glútea",
        badge: "Activación",
        badgeStyle: "bg-plasma/10 text-plasma border border-plasma/20",
        exercises: [
          {
            name: "Bicicleta o remo suave",
            volume: "3 min",
            description: "Aumento de temperatura corporal y flujo sanguíneo general."
          },
          {
            name: "Glute bridge con banda sobre rodillas, pausa 2s",
            volume: "2 × 15",
            description: "Conexión mente-músculo antes de cargar peso."
          },
          {
            name: "Clamshell con banda",
            volume: "2 × 12 c/lado",
            description: "Activación del glúteo medio y rotadores externos de cadera."
          },
          {
            name: "Bird dog",
            volume: "2 × 8 c/lado",
            description: "Estabilización lumbopélvica activa."
          }
        ]
      },
      {
        title: "Ejercicio principal",
        badge: "Prioridad Glúteo",
        badgeStyle: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        exercises: [
          {
            name: "Hip thrust con barra (o máquina)",
            volume: "4 × 8-10",
            rest: "120s - 180s",
            science: "Estudio EMG: Mayor activación de glúteo máximo registrada en EMG (64-86% MVC). Progresar en peso semana a semana dentro de RIR 2-3.",
            tip: "Pausa 1-2s arriba apretando fuerte con la pelvis en retroversión posterior.",
            isKey: true,
            keyBadge: "rey del glúteo",
            loggable: true,
            sets: 4
          }
        ]
      },
      {
        title: "Bloque de fuerza — Isquios y cadena posterior",
        badge: "Fuerza",
        badgeStyle: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        exercises: [
          {
            name: "Peso muerto rumano (RDL) con barra o mancuernas",
            volume: "4 × 8-10",
            rest: "120s",
            science: "Estiramiento máximo de glúteo e isquios en la posición alargada — el complemento perfecto al hip thrust, que trabaja la posición contraída.",
            tip: "Bisagra de cadera pura, empujando la cadera hacia atrás como si quisieras tocar la pared.",
            loggable: true,
            sets: 4
          },
          {
            name: "Curl femoral en máquina (tumbada o sentada)",
            volume: "3 × 12",
            rest: "90s",
            science: "Aislamiento directo de isquiotibiales mediante flexión de rodilla activa.",
            tip: "Controla la fase excéntrica (bajada) en 2-3 segundos completos.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Bloque de hipertrofia y forma",
        badge: "Definición Glútea",
        badgeStyle: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20",
        note: "Un estudio de 2024 con mujeres jóvenes mostró que agregar hip thrust a un programa de piernas produjo 9.3% de incremento en grosor de glúteo mayor vs 6% sin él. Nunca te lo saltees.",
        exercises: [
          {
            name: "Bulgarian split squat con mancuernas",
            volume: "3 × 10 c/lado",
            rest: "90s",
            science: "Mayor rango de movimiento en estiramiento profundo, estimulando la hipertrofia de fibras en tensión máxima.",
            tip: "Pie trasero elevado en banco. Mantén una ligera inclinación del torso hacia adelante para cargar más el glúteo.",
            loggable: true,
            sets: 3
          },
          {
            name: "Cable kickback (polea baja, tobillera)",
            volume: "3 × 15 c/lado",
            rest: "60s",
            science: "Aislamiento puro del glúteo mayor sin involucrar el cuádriceps ni la espalda baja.",
            tip: "Alinea la polea con el vector de la fibra muscular y no balancees el torso.",
            loggable: true,
            sets: 3
          },
          {
            name: "Abductor en máquina (hip abduction)",
            volume: "3 × 15-20",
            rest: "60s",
            science: "Estimulación directa del glúteo medio y menor, fundamental para la estabilidad lateral y la estética.",
            tip: "Mantén una ligera inclinación hacia adelante para reclutar fibras del glúteo superior.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Vuelta a la calma",
        badge: "Recuperación",
        badgeStyle: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        exercises: [
          {
            name: "Piriforme / figura 4 en suelo",
            volume: "45 s c/lado",
            description: "Elongación y descompresión del nervio ciático y piramidal."
          },
          {
            name: "Isquiotibiales sentada",
            volume: "30 s c/lado",
            description: "Estiramiento pasivo suave de la cadena posterior."
          },
          {
            name: "Child's pose",
            volume: "1 min",
            description: "Relajación y respiración diafragmática profunda."
          }
        ]
      }
    ]
  },
  {
    id: "dia-b",
    name: "Día B",
    subtitle: "Empuje + Cuádriceps",
    tag: "Pecho·Hombro + Piernas",
    summary: {
      warmup: 8,
      main: 47,
      cooldown: 8,
      total: 63
    },
    sections: [
      {
        title: "Calentamiento",
        badge: "Movilidad",
        badgeStyle: "bg-plasma/10 text-plasma border border-plasma/20",
        exercises: [
          {
            name: "Remo o elíptica suave",
            volume: "3 min",
            description: "Activación del sistema cardiovascular."
          },
          {
            name: "Arm circles + band pull-apart",
            volume: "2 × 15",
            description: "Movilidad escapular y manguito rotador."
          },
          {
            name: "Sentadilla con peso corporal, pausa abajo",
            volume: "2 × 10",
            description: "Activación del rango de movimiento del tobillo y cadera."
          }
        ]
      },
      {
        title: "Bloque empuje — Tren superior",
        badge: "Tonificación",
        badgeStyle: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
        exercises: [
          {
            name: "Press de banca con mancuernas o barra",
            volume: "3 × 10-12",
            rest: "90s",
            science: "Rango óptimo (8-12 reps) para desarrollo miofibrilar y tensión mecánica sostenida.",
            tip: "Técnica limpia, retrae escápulas y mantén los codos en ángulo de 45°.",
            loggable: true,
            sets: 3
          },
          {
            name: "Press de hombros en máquina",
            volume: "3 × 10-12",
            rest: "90s",
            science: "Estimulación del deltoides anterior y lateral para estructura armónica superior.",
            tip: "Empuja sin bloquear los codos al final del movimiento.",
            loggable: true,
            sets: 3
          },
          {
            name: "Lateral raise con mancuernas",
            volume: "3 × 15",
            rest: "60s",
            science: "Aislamiento del deltoides lateral para crear amplitud de hombros.",
            tip: "Inclinación mínima hacia adelante y sube guiando con los codos.",
            loggable: true,
            sets: 3
          },
          {
            name: "Tricep pushdown en polea (cuerda)",
            volume: "3 × 12-15",
            rest: "60s",
            science: "Desarrollo del tríceps braquial en posición acortada.",
            tip: "Codos pegados al cuerpo, abre la cuerda abajo para contracción extra.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Bloque piernas — Cuádriceps",
        badge: "Estructural",
        badgeStyle: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        exercises: [
          {
            name: "Leg press con pies altos y algo separados",
            volume: "4 × 10-12",
            rest: "120s",
            science: "La posición alta del pie desplaza el énfasis de cuádriceps hacia glúteo e isquios sin perder el trabajo de pierna completa.",
            tip: "Baja controlado hasta que tus rodillas formen casi un ángulo de 90°.",
            isKey: true,
            keyBadge: "glúteo secundario",
            loggable: true,
            sets: 4
          },
          {
            name: "Zancada caminando con mancuernas",
            volume: "3 × 12 pasos c/lado",
            rest: "90s",
            science: "Trabajo unilateral funcional de alta demanda propioceptiva que activa glúteo medio en estabilización.",
            tip: "Mantén la rodilla delantera alineada con el segundo dedo del pie.",
            loggable: true,
            sets: 3
          },
          {
            name: "Extensión de cuádriceps en máquina",
            volume: "3 × 12-15",
            rest: "60s",
            science: "Aislamiento del recto femoral en acortamiento puro.",
            tip: "Pausa de 1s al contraer la pierna.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Vuelta a la calma",
        badge: "Recuperación",
        badgeStyle: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        exercises: [
          {
            name: "Estiramiento de pectoral en esquina",
            volume: "30 s × 2",
            description: "Elongación pasiva del pectoral mayor y deltoides anterior."
          },
          {
            name: "Cuádriceps de pie",
            volume: "30 s c/lado",
            description: "Flexión de rodilla estática para relajar cuádriceps y flexores de cadera."
          },
          {
            name: "Elongación de hombro cruzado",
            volume: "30 s c/lado",
            description: "Estiramiento pasivo de la cápsula posterior del hombro."
          }
        ]
      }
    ]
  },
  {
    id: "dia-c",
    name: "Día C",
    subtitle: "Jalón + Glúteo/Aductor",
    tag: "Espalda + Sumo",
    summary: {
      warmup: 8,
      main: 48,
      cooldown: 9,
      total: 65
    },
    sections: [
      {
        title: "Calentamiento",
        badge: "Movilidad",
        badgeStyle: "bg-plasma/10 text-plasma border border-plasma/20",
        exercises: [
          {
            name: "Remo suave",
            volume: "3 min",
            description: "Preparación de tracción y tren superior."
          },
          {
            name: "Cat-cow + rotación torácica",
            volume: "8 reps c/lado",
            description: "Movilización de columna vertebral en todos sus planos."
          },
          {
            name: "Sumo squat sin peso, movilidad de cadera",
            volume: "2 × 10",
            description: "Apertura articular previa a la carga externa."
          }
        ]
      },
      {
        title: "Ejercicio principal — Aductores + Glúteo",
        badge: "Enfoque Interno",
        badgeStyle: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20",
        exercises: [
          {
            name: "Sentadilla sumo con barra o mancuerna",
            volume: "4 × 8-10",
            rest: "120s",
            science: "El stance amplio en sumo aumenta la activación de aductores y glúteo medio significativamente más que la sentadilla convencional. Ideal para la cara interna del muslo con carga real.",
            tip: "Stance ancho, pies rotados afuera. Mantén las rodillas empujando hacia afuera en la misma dirección que la punta de tus pies.",
            isKey: true,
            keyBadge: "clave aductores",
            loggable: true,
            sets: 4
          }
        ]
      },
      {
        title: "Bloque jalón — Espalda",
        badge: "Tonificación",
        badgeStyle: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
        exercises: [
          {
            name: "Jalón al pecho en polea (lat pulldown)",
            volume: "3 × 10-12",
            rest: "90s",
            science: "Reclutamiento del dorsal ancho y redondo mayor.",
            tip: "Lleva la barra a la clavícula alta retrayendo hombros hacia abajo.",
            loggable: true,
            sets: 3
          },
          {
            name: "Remo en máquina o polea sentada",
            volume: "3 × 10-12",
            rest: "90s",
            science: "Tracción horizontal orientada al trapecio medio e inferior y romboides.",
            tip: "Aprieta las escápulas al final del movimiento.",
            loggable: true,
            sets: 3
          },
          {
            name: "Curl de bíceps con mancuernas",
            volume: "3 × 12",
            rest: "60s",
            science: "Aislamiento flexor del codo.",
            tip: "Mantén los codos inmóviles pegados a los costados.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Bloque glúteo/aductor — 2da frecuencia",
        badge: "Consistencia",
        badgeStyle: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
        exercises: [
          {
            name: "Hip thrust en máquina (o barra)",
            volume: "3 × 10-12",
            rest: "90s",
            science: "Frecuencia 2: Distribuir el volumen semanal en 2-3 sesiones produce mejores adaptaciones que concentrarlo en un solo día.",
            tip: "Volumen medio, enfocado en exprimir la contracción máxima.",
            isKey: true,
            keyBadge: "glúteo x semana",
            loggable: true,
            sets: 3
          },
          {
            name: "Aductor en máquina (hip adduction)",
            volume: "3 × 15-20",
            rest: "60s",
            science: "Aislamiento directo de la musculatura aductora (magnus, longus, brevis) en un plano estabilizado.",
            tip: "Controla la fase excéntrica lenta y realiza una pausa al contraer al centro.",
            isKey: true,
            keyBadge: "aductores directo",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Vuelta a la calma",
        badge: "Recuperación",
        badgeStyle: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        exercises: [
          {
            name: "Estiramiento de aductores (mariposa sentada)",
            volume: "45 s",
            description: "Relajación de la musculatura interna del muslo."
          },
          {
            name: "Elongación de dorsales en polea baja",
            volume: "30 s c/lado",
            description: "Estiramiento del dorsal ancho mediante tracción pasiva asistida."
          },
          {
            name: "Figura 4 en suelo",
            volume: "30 s c/lado",
            description: "Estiramiento suave del piramidal y rotadores de cadera."
          }
        ]
      }
    ]
  },
  {
    id: "dia-d",
    name: "Día D",
    subtitle: "Full Body + Metabólico",
    tag: "Definición + Cardio",
    summary: {
      warmup: 7,
      main: 38,
      metabolic: 10,
      cooldown: 8,
      total: 63
    },
    sections: [
      {
        title: "Calentamiento",
        badge: "Activación",
        badgeStyle: "bg-plasma/10 text-plasma border border-plasma/20",
        exercises: [
          {
            name: "Bicicleta o escaladora suave",
            volume: "3 min",
            description: "Aumento térmico metabólico general."
          },
          {
            name: "Squat to stand + hip opener",
            volume: "8 reps",
            description: "Movilidad dinámica de cadera e isquiotibiales."
          },
          {
            name: "Glute bridge activación",
            volume: "2 × 12",
            description: "Estímulo neuromuscular previo a ejercicios integrados."
          }
        ]
      },
      {
        title: "Bloque full body — Glúteo, core y definición",
        badge: "Forma Completa",
        badgeStyle: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        exercises: [
          {
            name: "Sentadilla frontal (goblet o barra) o step-up",
            volume: "3 × 10",
            rest: "90s",
            science: "Patrón vertical de pierna con alta demanda del cuádriceps y estabilización central.",
            tip: "Mantén el pecho erguido y las escápulas activas durante todo el recorrido.",
            loggable: true,
            sets: 3
          },
          {
            name: "Cable pull-through (polea baja, entre las piernas)",
            volume: "3 × 12-15",
            rest: "90s",
            science: "Vector de fuerza horizontal en bisagra de cadera. Enseña el patrón de empuje sin sobrecargar la columna.",
            tip: "Bisagra pura, extiende la cadera apretando fuerte los glúteos al final del rango.",
            loggable: true,
            sets: 3
          },
          {
            name: "Hiperextensión / reverse hyper en banco",
            volume: "3 × 12-15",
            rest: "90s",
            science: "Cadena posterior completa en extensión máxima. Ideal para dar forma a la unión glúteo-isquiotibial.",
            tip: "Enfócate en iniciar el movimiento contrayendo los glúteos, no tirando de la lumbar.",
            loggable: true,
            sets: 3
          },
          {
            name: "Superserie: Abductor + Aductor en máquina",
            volume: "3 × 15 c/u",
            rest: "60s entre rondas",
            science: "Sin descanso. Agotamiento metabólico directo de la cara lateral y medial de cadera.",
            tip: "Controla cada repetición y evita usar el impulso de la espalda.",
            isKey: true,
            keyBadge: "definición cadera",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Core",
        badge: "Estabilidad",
        badgeStyle: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
        exercises: [
          {
            name: "Plank con toque de hombro",
            volume: "3 × 10 c/lado",
            rest: "60s",
            science: "Resistencia anti-rotación activa del core.",
            tip: "Intenta que la cadera no oscile al levantar la mano.",
            loggable: true,
            sets: 3
          },
          {
            name: "Cable crunch (polea alta)",
            volume: "3 × 15",
            rest: "60s",
            science: "Flexión de columna con carga controlada.",
            tip: "Lleva los codos hacia tus muslos enrollando la columna.",
            loggable: true,
            sets: 3
          }
        ]
      },
      {
        title: "Finisher metabólico",
        badge: "Quema Grasa",
        badgeStyle: "bg-red-500/10 text-red-400 border border-red-500/20",
        note: "Este bloque reemplaza al día de running: es más corto, más eficiente para el objetivo de recomposición corporal, y no compite por recursos de recuperación con el trabajo de glúteo de los otros 3 días.",
        exercises: [
          {
            name: "Intervalos en bici, escaladora o remo",
            volume: "10 min (10 rondas)",
            science: "Protocolo HIIT: 20s de esfuerzo máximo seguidos de 40s de recuperación pasiva/activa suave.",
            tip: "Mantén la máxima intensidad posible en los sprints de 20 segundos.",
            loggable: true,
            sets: 10
          }
        ]
      },
      {
        title: "Vuelta a la calma",
        badge: "Recuperación",
        badgeStyle: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        exercises: [
          {
            name: "Estiramiento completo de cuerpo",
            volume: "6 min",
            description: "Descompresión muscular general de extremidades y tronco."
          },
          {
            name: "Respiración en child's pose",
            volume: "2 min",
            description: "Retorno al estado parasimpático mediante respiraciones profundas."
          }
        ]
      }
    ]
  }
];

export const weeklySchedule: WeeklyScheduleItem[] = [
  { day: "Lunes", session: "A", name: "Glúteo + Isquios", color: "#7B61FF" },
  { day: "Martes", session: "B", name: "Empuje + Cuádriceps", color: "#06B6D4" },
  { day: "Miércoles", session: "Descanso", name: "Recuperación Completa", color: "#3F3F46" },
  { day: "Jueves", session: "C", name: "Jalón + Glúteo/Aductor", color: "#EC4899" },
  { day: "Viernes", session: "D", name: "Full Body + Metabólico", color: "#E11D48" },
  { day: "Sábado", session: "Descanso", name: "Activo / Caminata suave", color: "#3F3F46" },
  { day: "Domingo", session: "Descanso", name: "Recuperación Completa", color: "#3F3F46" }
];

export const scienceFactors: ScienceFactor[] = [
  {
    element: "Glúteo 3x/semana",
    reason: "Hip thrust (Día A, carga alta) + hip thrust máquina (Día C, volumen medio) + pull-through/hiperextensión (Día D, patrón distinto). La frecuencia distribuida da mejor resultado que concentrar todo en un día."
  },
  {
    element: "Aductores dedicados",
    reason: "Sumo squat (compuesto, Día C) + máquina de aductores (aislamiento, Días C y D) — cubre carga pesada y definición fina."
  },
  {
    element: "Abductor + forma de cadera",
    reason: "Presente en Días A y D — es lo que da la forma redondeada lateral y \"afina\" visualmente la zona de la cadera."
  },
  {
    element: "Finisher metabólico (solo Día D)",
    reason: "Suficiente estímulo cardiovascular para el déficit calórico sin interferir con la recuperación del volumen de glúteo, que es la prioridad."
  },
  {
    element: "Rangos 8-12 reps",
    reason: "Zona óptima de hipertrofia con carga significativa (60-80% 1RM), consistente en toda la evidencia reciente."
  }
];
