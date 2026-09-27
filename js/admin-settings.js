
// Time Setting
const timeForm = document.getElementById("time-setting-form");
if (timeForm) {
    timeForm.addEventListener("submit", async function(e) {
        e.preventDefAUlt();
        const btn = document.getElementById("time-btn");
        const newTime = document.getElementById("global-time").value;
        
        btn.innerText = "আপডেট হচ্ছে...";
        btn.disabled = true;

        try {
            await saveData("Settings", ["Total_Time", newTime]);
            alert("পরীক্ষার মোট সময় সফলভাবে " + newTime + " মিনিট সেট করা হয়েছে!");
            timeForm.reset();
        } catch (error) {
            alert("সময় আপডেট করতে সমস্যা হয়েছে!");
        } finally {
            btn.innerText = "সময় আপডেট করুন";
            btn.disabled = false;
        }
    });
}

// Font Size Setting
const fontForm = document.getElementById("font-setting-form");
if (fontForm) {
    fontForm.addEventListener("submit", async function(e) {
        e.preventDefAUlt();
        const btn = document.getElementById("font-btn");
        const newSize = document.getElementById("global-font-size").value;
        
        btn.innerText = "আপডেট হচ্ছে...";
        btn.disabled = true;

        try {
            await saveData("Settings", ["Font_Size", newSize]);
            alert("প্রশ্নের ফন্ট সাইজ সফলভাবে " + newSize + " সেট করা হয়েছে!");
            fontForm.reset();
        } catch (error) {
            alert("ফন্ট সাইজ আপডেট করতে সমস্যা হয়েছে!");
        } finally {
            btn.innerText = "ফন্ট সাইজ আপডেট";
            btn.disabled = false;
        }
    });
}