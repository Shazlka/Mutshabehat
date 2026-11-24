plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

fun publicConfig(name: String, default: String = ""): String =
    providers.gradleProperty(name).orElse(default).get()
        .replace("\\", "\\\\").replace("\"", "\\\"")
        .let { "\"$it\"" }

android {
    namespace = "com.shazlka.qiraat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.shazlka.qiraat"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.4.3-native-auth"

        for (name in listOf("QIRAAT_CLOUD_ORIGIN", "QIRAAT_CLOUD_ISSUER", "QIRAAT_CLOUD_CLIENT_ID")) {
            buildConfigField("String", name, publicConfig(name))
        }

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "QIRAAT_CLOUD_ORIGIN", publicConfig("QIRAAT_CLOUD_ORIGIN", "https://br-still-sunset-bgeylsq4-qiraatsync.compute.c-9.eu-central-1.aws.neon.tech"))
            buildConfigField("String", "QIRAAT_CLOUD_ISSUER", publicConfig("QIRAAT_CLOUD_ISSUER", "https://ep-silent-frost-bglqosbx.neonauth.c-9.eu-central-1.aws.neon.tech/neondb/auth"))
            buildConfigField("String", "QIRAAT_CLOUD_CLIENT_ID", publicConfig("QIRAAT_CLOUD_CLIENT_ID", "MrnWcXbCmpeSORVQYKQMXIolZygFSpNc"))
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                val testHome = layout.buildDirectory.dir("robolectric-home").get().asFile
                it.systemProperty("user.home", testHome.absolutePath)
                it.doFirst { testHome.mkdirs() }
            }
        }
    }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.kotlinx.serialization.json)
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
