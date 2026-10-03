"""Treatment advice for the rice, tea and coconut classes added in disease model v3.

Keyed by the EXACT label string from disease_labels.json (not the normalized name used by
TREATMENT_LOOKUP). That matters: after crop-prefix stripping, "Coconut___Gray_leaf_spot" would
collide with the corn entry "gray leaf spot", which is a different disease.

DRAFT: have an agronomist or the relevant institute (Tea Research Institute, Coconut Research
Institute, Rice Research and Development Institute, Department of Agriculture) review this text
before it is shown to farmers. Two entries are marked below as needing expert confirmation.
"""

LOCAL_CROP_LOOKUP: dict[str, dict] = {
    # ---------------------------------------------------------------- rice
    "Rice___Bacterial_leaf_blight": {
        "severity": "high",
        "causes": "Bacterium Xanthomonas oryzae pv. oryzae. It spreads through irrigation and rain water, infected seed and stubble, and is worse with heavy nitrogen and leaves wounded by storms.",
        "organic_treatment": "Avoid adding more nitrogen while symptoms are spreading. Remove weed hosts and infected stubble, and keep water from flowing from infected plots into healthy ones.",
        "chemical_treatment": "No reliably effective chemical cure; copper-based products give limited protection. Check with the local Department of Agriculture office before spraying.",
        "prevention_tips": "Use resistant varieties and certified clean seed, balanced fertilization (avoid excess nitrogen), clean tools and bunds, and destroy infected stubble after harvest.",
    },
    "Rice___Brown_spot": {
        "severity": "moderate",
        "causes": "Fungus Bipolaris oryzae. Common where plants are stressed by poor soil fertility, nutrient shortage (especially potassium) or drought, and where seed is infected.",
        "organic_treatment": "Correct nutrient shortages with balanced fertilizer and organic matter. Remove badly affected plants and weeds, and keep the water supply steady.",
        "chemical_treatment": "If the infection is severe, use a registered fungicide recommended by the local extension office. Treating seed before sowing is a standard preventive step.",
        "prevention_tips": "Use clean or treated seed, resistant varieties and balanced fertilization including potassium, and avoid water stress.",
    },
    "Rice___Leaf_blast": {
        "severity": "critical",
        "causes": "Fungus Magnaporthe oryzae (Pyricularia oryzae). Favored by high humidity, long periods of leaf wetness, cool nights and heavy nitrogen.",
        "organic_treatment": "Stop extra nitrogen, keep fields evenly flooded, and remove infected plant debris and weed hosts.",
        "chemical_treatment": "A registered blast fungicide applied early, as advised by the local extension office or rice research institute. Follow label rates and rotate active ingredients.",
        "prevention_tips": "Use resistant varieties and certified clean seed, split nitrogen applications, avoid very late planting, and scout fields during wet, humid spells.",
    },
    # ---------------------------------------------------------------- tea
    "Tea___Algal_leaf_spot": {
        "severity": "moderate",
        "causes": "Parasitic alga (Cephaleuros species). Common in humid, heavily shaded, poorly drained or nutrient-poor tea fields.",
        "organic_treatment": "Improve drainage and air flow through pruning and shade regulation, and remove heavily infected leaves.",
        "chemical_treatment": "Copper-based fungicide if the infection keeps spreading, as advised by the Tea Research Institute.",
        "prevention_tips": "Balanced fertilization, good drainage, avoid dense shade, and keep bushes healthy and well pruned.",
    },
    "Tea___Black_blight": {
        # NEEDS EXPERT CONFIRMATION: cause and control for this class should be checked by a tea pathologist.
        "severity": "moderate",
        "causes": "Leaf disease that spreads in wet, humid weather, often through damaged leaves. The exact cause should be confirmed by the Tea Research Institute.",
        "organic_treatment": "Remove and destroy infected leaves, and improve air flow and drainage in the field.",
        "chemical_treatment": "Use only a fungicide recommended by the Tea Research Institute for this disease.",
        "prevention_tips": "Avoid wounding leaves during plucking, keep regular plucking rounds, maintain good drainage and balanced nutrition.",
    },
    "Tea___Blister_blight": {
        "severity": "critical",
        "causes": "Fungus Exobasidium vexans. Spreads by windborne spores and thrives in cool, misty, wet weather, mainly attacking young shoots.",
        "organic_treatment": "Keep plucking rounds short so infected shoots are removed, improve shade regulation and air flow, and destroy infected shoots.",
        "chemical_treatment": "A fungicide programme (copper-based or systemic) timed to wet weather, as recommended by the Tea Research Institute. Rotate active ingredients.",
        "prevention_tips": "Use resistant clones, pluck regularly, keep drainage good, and monitor closely during cool, wet spells when the disease spreads fastest.",
    },
    "Tea___Gray_blight": {
        "severity": "moderate",
        "causes": "Fungus Pestalotiopsis (Pestalotiopsis theae). Enters through wounds from plucking, pruning, insects or sunscald, and spreads in humid weather.",
        "organic_treatment": "Remove infected leaves, avoid wounding the bushes, and improve nutrition and shade.",
        "chemical_treatment": "Copper-based or other registered fungicide on heavily affected bushes, as recommended by the Tea Research Institute.",
        "prevention_tips": "Careful plucking and pruning, balanced nutrition, good drainage, and control of insects that damage leaves.",
    },
    "Tea___Spider_mites": {
        "severity": "moderate",
        "causes": "Mite infestation (commonly red spider mite). Worse in hot, dry weather and on dusty bushes.",
        "organic_treatment": "Spray water or neem-based products on the underside of leaves, keep shade trees, and encourage natural predators.",
        "chemical_treatment": "A registered miticide recommended by the Tea Research Institute. Avoid broad-spectrum insecticides that kill predators, and rotate active ingredients.",
        "prevention_tips": "Maintain shade and soil moisture, reduce dust from field roads, and scout during dry spells.",
    },
    "Tea___healthy": {
        "severity": "low",
        "causes": "No disease detected.",
        "organic_treatment": "No treatment needed. Continue routine monitoring.",
        "chemical_treatment": "Not applicable.",
        "prevention_tips": "Maintain good field hygiene, balanced fertilization, and regular scouting.",
    },
    # ---------------------------------------------------------------- coconut
    "Coconut___Bud_root_dropping": {
        # NEEDS EXPERT CONFIRMATION: the exact meaning of this class should be checked with the Coconut Research Institute.
        "severity": "moderate",
        "causes": "Early dropping of buds or nuts. Possible causes include disease, poor nutrition, water stress and pests, so it needs on-site diagnosis.",
        "organic_treatment": "Check the palm for pests, disease signs and water or nutrient stress. Apply balanced fertilizer and organic matter, and keep irrigation steady.",
        "chemical_treatment": "Do not spray blindly. Ask the Coconut Research Institute or the local extension officer to diagnose the cause first.",
        "prevention_tips": "Regular fertilization, steady water supply, good drainage and routine inspection of the crown.",
    },
    "Coconut___Bud_rot": {
        "severity": "critical",
        "causes": "Fungus-like pathogen Phytophthora palmivora. It infects the growing point (bud) in wet, humid weather and can kill the palm.",
        "organic_treatment": "Cut away and burn the infected crown tissue as soon as it is noticed, then protect the cut area with a copper-based paste (Bordeaux paste). Improve drainage.",
        "chemical_treatment": "Copper-based fungicide (for example Bordeaux mixture) on the crown, as advised by the Coconut Research Institute. Act quickly; contact an extension officer today.",
        "prevention_tips": "Good drainage, avoid injuring the crown, preventive copper sprays on neighboring palms before the monsoon, and remove dead palms.",
    },
    "Coconut___Gray_leaf_spot": {
        "severity": "moderate",
        "causes": "Fungus Pestalotiopsis palmarum. Common on weakened palms and nursery seedlings, especially in humid weather.",
        "organic_treatment": "Remove and burn badly affected leaves, and improve nutrition with balanced fertilizer and organic matter.",
        "chemical_treatment": "Copper-based or other registered fungicide on young palms and nursery seedlings, as advised by the Coconut Research Institute.",
        "prevention_tips": "Balanced fertilization (including potassium), good spacing and drainage, and healthy planting material.",
    },
    "Coconut___Leaf_rot": {
        "severity": "moderate",
        "causes": "A complex of fungi that rot the young leaves, often after weather stress or poor nutrition.",
        "organic_treatment": "Cut and burn badly affected leaves, and improve nutrition and water management.",
        "chemical_treatment": "A registered fungicide applied to the spindle leaves, as recommended by the Coconut Research Institute.",
        "prevention_tips": "Balanced fertilizer, good drainage, removal of diseased leaves, and regular checks on young palms.",
    },
    "Coconut___Stem_bleeding": {
        "severity": "moderate",
        "causes": "Fungus Thielaviopsis paradoxa entering through wounds in the trunk. Shows as a reddish-brown liquid oozing from the stem.",
        "organic_treatment": "Scrape off the affected bark and tissue with a chisel, then apply hot coal tar or Bordeaux paste to the wound. Avoid making new wounds on the trunk.",
        "chemical_treatment": "A registered fungicide as advised by the Coconut Research Institute. Treating early gives the best chance of saving the palm.",
        "prevention_tips": "Avoid injuring the trunk, keep soil drained, apply balanced fertilizer and organic manure, and treat at the first sign.",
    },
}
