const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        const btn = document.getElementById("login-btn");
        const msg = document.getElementById("login-msg");
        const enteredId = document.getElementById("login_id").value.trim();
        const enteredPass = document.getElementById("login_pass").value.trim();
        
        btn.innerText = "যাচাই করা হচ্ছে...";
        btn.disabled = true;
        msg.innerText = "";

        try {
            // Students শিট থেকে ডেটা আনা
            const studentsData = await fetchData("Students");
            
            // আইডি ও পাসওয়ার্ড ম্যাচ করানো এবং স্ট্যাটাস চেক করা
            const validStudent = studentsData.find(student => 
                student.Student_ID == enteredId && 
                student.Password == enteredPass
            );

            if (validStudent) {
                if (validStudent.Status === "Active") {
                    msg.style.color = "green";
                    msg.innerText = "লগিন সফল! ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...";
                    
                    // ব্রাউজারে স্টুডেন্টের তথ্য সেভ করে রাখা (যাতে এক্সাম পেজে ব্যবহার করা যায়)
                    sessionStorage.setItem("loggedInStudent", JSON.stringify(validStudent));
                    
                    // ২ সেকেন্ড পর ড্যাশবোর্ডে রিডাইরেক্ট
                    setTimeout(() => {
                        window.location.href = "dashboard.html";
                    }, 1500);
                } else {
                    msg.style.color = "red";
                    msg.innerText = "আপনার অ্যাকাউন্টটি ব্লক করা আছে। অ্যাডমিনের সাথে যোগাযোগ করুন।";
                    btn.innerText = "লগিন করুন";
                    btn.disabled = false;
                }
            } else {
                msg.style.color = "red";
                msg.innerText = "ভুল আইডি বা পাসওয়ার্ড!";
                btn.innerText = "লগিন করুন";
                btn.disabled = false;
            }

        } catch (error) {
            msg.style.color = "red";
            msg.innerText = "ইন্টারনেট কানেকশন বা API সমস্যা!";
            btn.innerText = "লগিন করুন";
            btn.disabled = false;
        }
    });
}
