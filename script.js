// =====================================================
// 1) เกณฑ์ระดับสารอาหารต่อ 100 กรัม (แก้ตัวเลขตรงนี้ได้เลย)
//    ค่า <= low  → ต่ำ (เขียว)
//    ค่า >  high → สูง (แดง)
//    ระหว่างนั้น  → ปานกลาง (เหลือง)
// =====================================================
const LIMITS = {
  sugars:       { low: 5,   high: 22.5 },
  fat:          { low: 3,   high: 17.5 },
  saturatedFat: { low: 1.5, high: 5 },
  salt:         { low: 0.3, high: 1.5 }
};

// รายการสารอาหารที่จะแสดงในตาราง
// limit = ชื่อเกณฑ์ใน LIMITS (ถ้าไม่มีเกณฑ์ให้ใส่ null)
const NUTRIENTS = [
  { label: "พลังงาน",      key: "energy-kcal_100g",   unit: "กิโลแคลอรี", limit: null },
  { label: "น้ำตาล",        key: "sugars_100g",        unit: "กรัม",       limit: "sugars" },
  { label: "ไขมัน",         key: "fat_100g",           unit: "กรัม",       limit: "fat" },
  { label: "ไขมันอิ่มตัว",   key: "saturated-fat_100g", unit: "กรัม",       limit: "saturatedFat" },
  { label: "เกลือ",         key: "salt_100g",          unit: "กรัม",       limit: "salt" }
];

// ชนิดบาร์โค้ดที่ให้กล้องอ่าน
const BARCODE_FORMATS = [
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E"
];


// =====================================================
// 2) ดึงส่วนต่าง ๆ ของหน้าเว็บมาเก็บในตัวแปร
// =====================================================
const input = document.getElementById("barcode");
const searchBtn = document.getElementById("searchBtn");
const messageBox = document.getElementById("message");
const resultBox = document.getElementById("result");

const readerBox = document.getElementById("reader");
const openCameraBtn = document.getElementById("openCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const nextScanBtn = document.getElementById("nextScanBtn");


// =====================================================
// 3) ฟังก์ชันช่วยแสดงข้อความ
// =====================================================
function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = "message " + type;
}

function hideMessage() {
  messageBox.className = "message hidden";
}

// ถ้าไม่มีข้อความ ให้คืนค่า "-"
function textOrDash(value) {
  if (value === undefined || value === null) {
    return "-";
  }
  const text = String(value).trim();
  if (text === "") {
    return "-";
  }
  return text;
}

// แปลงค่าที่ได้จาก API เป็นตัวเลข ถ้าไม่มีหรือไม่ใช่ตัวเลข ให้คืน null
function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  return num;
}


// =====================================================
// 4) ฟังก์ชันคำนวณค่าสารอาหาร
// =====================================================

// อ่านค่าสารอาหาร 1 ตัว
// ถ้าเป็นเกลือแต่ไม่มี salt_100g ให้คำนวณจากโซเดียม: เกลือ = โซเดียม × 2.5
function getNutrientValue(nutriments, key) {
  let value = toNumber(nutriments[key]);

  if (key === "salt_100g" && value === null) {
    const sodium = toNumber(nutriments["sodium_100g"]);
    if (sodium !== null) {
      value = sodium * 2.5;
    }
  }

  return value;
}

// หาระดับของสารอาหาร: คืนค่า "low", "medium", "high" หรือ null
function getLevel(limitName, value) {
  if (limitName === null || value === null) {
    return null;
  }

  const limit = LIMITS[limitName];

  if (value <= limit.low) {
    return "low";
  } else if (value > limit.high) {
    return "high";
  } else {
    return "medium";
  }
}

// สร้างป้ายสีตามระดับ
function createBadge(level) {
  const badge = document.createElement("span");

  if (level === "low") {
    badge.className = "badge badge-low";
    badge.textContent = "ต่ำ";
  } else if (level === "medium") {
    badge.className = "badge badge-medium";
    badge.textContent = "ปานกลาง";
  } else if (level === "high") {
    badge.className = "badge badge-high";
    badge.textContent = "สูง";
  }

  return badge;
}

// จัดรูปแบบตัวเลข เช่น 12.345 → "12.35 กรัม"
function formatValue(value, unit) {
  if (value === null) {
    return "-";
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("th-TH") + " " + unit;
}


// =====================================================
// 5) แสดงข้อมูลสินค้าบนหน้าเว็บ
// =====================================================
function showProduct(product, barcode) {
  // ชื่อสินค้า: ใช้ชื่อภาษาไทยก่อน ถ้าไม่มีค่อยใช้ชื่ออื่น
  const name = product.product_name_th || product.product_name || product.product_name_en;

  document.getElementById("productName").textContent = textOrDash(name);
  document.getElementById("productBrand").textContent = "ยี่ห้อ: " + textOrDash(product.brands);
  document.getElementById("productBarcode").textContent = "บาร์โค้ด: " + barcode;

  // รูปสินค้า
  const imageBox = document.getElementById("imageBox");
  imageBox.innerHTML = "";

  const imageUrl = product.image_front_url || product.image_url;

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "รูปสินค้า";
    img.onerror = function () {
      imageBox.innerHTML = '<span class="no-image">ไม่มีรูปสินค้า</span>';
    };
    imageBox.appendChild(img);
  } else {
    imageBox.innerHTML = '<span class="no-image">ไม่มีรูปสินค้า</span>';
  }

  // ตารางโภชนาการ
  const nutriments = product.nutriments || {};
  const tbody = document.getElementById("nutriTable");
  tbody.innerHTML = "";

  for (const item of NUTRIENTS) {
    const value = getNutrientValue(nutriments, item.key);
    const level = getLevel(item.limit, value);

    const row = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.textContent = item.label;

    const valueCell = document.createElement("td");
    valueCell.className = "value";
    valueCell.textContent = formatValue(value, item.unit);

    const levelCell = document.createElement("td");
    levelCell.className = "level";
    if (level !== null) {
      levelCell.appendChild(createBadge(level));
    }

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    row.appendChild(levelCell);
    tbody.appendChild(row);
  }

  resultBox.classList.remove("hidden");
}


// =====================================================
// 6) ค้นหาสินค้าจาก Open Food Facts
// =====================================================
async function searchProduct(barcode) {
  resultBox.classList.add("hidden");

  if (barcode === "") {
    showMessage("กรุณาพิมพ์เลขบาร์โค้ด", "error");
    return;
  }

  if (!/^\d+$/.test(barcode)) {
    showMessage("เลขบาร์โค้ดต้องเป็นตัวเลขเท่านั้น", "error");
    return;
  }

  showMessage("กำลังค้นหา...", "loading");
  searchBtn.disabled = true;

  try {
    const url = "https://world.openfoodfacts.org/api/v2/product/" + barcode + ".json";
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 0 || !data.product) {
      showMessage("ไม่พบสินค้า (บาร์โค้ด " + barcode + ")", "error");
      return;
    }

    hideMessage();
    showProduct(data.product, barcode);
  } catch (error) {
    showMessage("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่", "error");
  } finally {
    searchBtn.disabled = false;
  }
}


// =====================================================
// 7) กล้องสแกนบาร์โค้ด (ใช้ไลบรารี html5-qrcode)
// =====================================================
let scanner = null;       // ตัวสแกน (สร้างครั้งแรกตอนเปิดกล้อง)
let isScanning = false;   // true = กำลังรออ่านบาร์โค้ด

// สลับปุ่มตามสถานะ: "idle" = ยังไม่เปิดกล้อง, "scanning" = กำลังสแกน, "done" = สแกนเสร็จแล้ว
function setCameraButtons(state) {
  openCameraBtn.classList.toggle("hidden", state !== "idle");
  stopCameraBtn.classList.toggle("hidden", state !== "scanning");
  nextScanBtn.classList.toggle("hidden", state !== "done");
  readerBox.classList.toggle("hidden", state !== "scanning");
}

// แปลงข้อผิดพลาดของกล้องเป็นคำอธิบายภาษาไทย
function getCameraErrorMessage(error) {
  const text = String(error);

  if (text.includes("NotAllowedError") || text.includes("Permission")) {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง\n" +
           "วิธีแก้: กดรูปแม่กุญแจข้างช่องที่อยู่เว็บ แล้วเลือก \"อนุญาต\" กล้อง จากนั้นรีเฟรชหน้าเว็บ\n" +
           "iPhone: ไปที่ การตั้งค่า > Safari > กล้อง > อนุญาต";
  }

  if (text.includes("NotFoundError") || text.includes("OverconstrainedError")) {
    return "ไม่พบกล้องบนอุปกรณ์นี้\nวิธีแก้: ลองเปิดหน้าเว็บนี้บนมือถือ หรือพิมพ์เลขบาร์โค้ดแทน";
  }

  if (text.includes("NotReadableError") || text.includes("TrackStartError")) {
    return "กล้องกำลังถูกแอปอื่นใช้งานอยู่\nวิธีแก้: ปิดแอปที่ใช้กล้อง (เช่น แอปกล้อง, LINE, Zoom) แล้วลองใหม่";
  }

  return "เปิดกล้องไม่ได้\n" +
         "วิธีแก้: ถ้าเปิดลิงก์จาก LINE หรือ Facebook ให้กด \"เปิดใน Safari/Chrome\" ก่อน " +
         "หรือพิมพ์เลขบาร์โค้ดแทน";
}

// เปิดกล้อง
async function openCamera() {
  hideMessage();

  // กล้องใช้ได้เฉพาะหน้าเว็บที่เป็น https (หรือ localhost)
  if (!window.isSecureContext) {
    showMessage("เปิดกล้องไม่ได้ เพราะหน้าเว็บนี้ไม่ได้เปิดผ่าน https\n" +
                "วิธีแก้: เปิดผ่านลิงก์ GitHub Pages (https://...) หรือพิมพ์เลขบาร์โค้ดแทน", "error");
    return;
  }

  // ตรวจว่าโหลดไลบรารีจาก CDN สำเร็จหรือไม่
  if (typeof Html5Qrcode === "undefined") {
    showMessage("โหลดตัวอ่านบาร์โค้ดไม่สำเร็จ\nวิธีแก้: ตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ", "error");
    return;
  }

  setCameraButtons("scanning");

  // สร้างตัวสแกนครั้งแรกครั้งเดียว
  if (scanner === null) {
    const formats = BARCODE_FORMATS.map(function (name) {
      return Html5QrcodeSupportedFormats[name];
    });

    scanner = new Html5Qrcode("reader", {
      formatsToSupport: formats,
      verbose: false,
      // ใช้ตัวอ่านบาร์โค้ดของเบราว์เซอร์ถ้ามี (Chrome บน Android อ่านได้เร็วขึ้นมาก)
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    });
  }

  // ตั้งค่ากล้อง: กรอบสแกนเป็นแนวนอน เหมาะกับบาร์โค้ดแบบแท่ง
  const config = {
    fps: 10,
    qrbox: function (width, height) {
      return {
        width: Math.floor(width * 0.85),
        height: Math.floor(width * 0.4)
      };
    }
  };

  try {
    isScanning = true;
    await scanner.start({ facingMode: "environment" }, config, onScanSuccess, function () {
      // ทุกเฟรมที่ยังอ่านไม่ได้จะเข้ามาที่นี่ ไม่ต้องทำอะไร
    });
  } catch (error) {
    isScanning = false;
    setCameraButtons("idle");
    showMessage(getCameraErrorMessage(error), "error");
  }
}

// ปิดกล้อง
async function stopCamera() {
  isScanning = false;
  if (scanner !== null && scanner.isScanning) {
    try {
      await scanner.stop();
    } catch (error) {
      // ปิดไม่สำเร็จก็ไม่เป็นไร
    }
  }
}

// เมื่ออ่านบาร์โค้ดได้
async function onScanSuccess(decodedText) {
  // กันอ่านซ้ำ: ถ้าอ่านได้ไปแล้ว ให้ข้ามครั้งต่อไป
  if (!isScanning) {
    return;
  }

  // หยุดกล้องทันที
  await stopCamera();
  setCameraButtons("done");

  // สั่นเครื่อง (iPhone ไม่รองรับ จึงต้องเช็กก่อน)
  if (navigator.vibrate) {
    navigator.vibrate(200);
  }

  // ใส่เลขลงช่องพิมพ์ แล้วค้นหาเหมือนการพิมพ์เอง
  input.value = decodedText;
  searchProduct(decodedText);
}

// สแกนชิ้นถัดไป
function scanNext() {
  resultBox.classList.add("hidden");
  input.value = "";
  openCamera();
}

// ปิดกล้องโดยผู้ใช้กดปุ่ม
async function onStopClick() {
  await stopCamera();
  setCameraButtons("idle");
}


// =====================================================
// 8) ผูกปุ่มกับฟังก์ชัน
// =====================================================
searchBtn.addEventListener("click", function () {
  searchProduct(input.value.trim());
});

input.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    searchProduct(input.value.trim());
  }
});

openCameraBtn.addEventListener("click", openCamera);
stopCameraBtn.addEventListener("click", onStopClick);
nextScanBtn.addEventListener("click", scanNext);
