THREE.NormalMaker = function( renderer ){

    this.timer = null;

    this.w = 0;
    this.h = 0;

    this.sharpen = 0;
    this.blur = 0;
    this.emboss = 0;

    this.Dither = 0;

    this.Rblur = 0;

    this.quality = 1;
    this.blurX = 1;
    this.blurY = 1;

    this.finalPixels = null;

    this.renderer = renderer;

    this.settings = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat } 

    this.renderTarget = new THREE.WebGLRenderTarget( 512, 512, this.settings );

    this.texture = this.renderTarget.texture;

    this.material = new THREE.MeshNormalMaterial();
    this.camera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
    this.camera.position.z = 1;
    this.scene = new THREE.Scene();

    this.plane = null;
    this.geometry = null;

    //new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), this.material );
   // var sph2 = new THREE.Mesh( new THREE.SphereBufferGeometry(0.8, 30, 30), this.material );
    //this.scene.add( this.plane );
    //this.scene.add( sph2 );
}

THREE.NormalMaker.prototype = {

    resolution : function( size ){

        this.renderTarget.dispose();
        this.renderTarget = new THREE.WebGLRenderTarget( size, size, this.settings );
        this.texture = this.renderTarget.texture;

        this.scene.remove( this.plane );
        this.plane = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2, size-1, size-1 ), this.material );
        this.scene.add( this.plane );

    },

    load : function( url ){

        this.dispose();

        var img = new Image();
        img.onload = function(){

            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            this.w = canvas.width;
            this.h = canvas.height;
            this.ctx = canvas.getContext("2d");

            this.ctx.drawImage(img,0,0);
            
            this.makeTerrain();

        }.bind(this);

        img.src = url;

    },

    makeTerrain:function( ){

        var newgeo = this.geometry === null ? true : false;

        

        this.finalPixels = this.ctx.getImageData( 0, 0, this.w, this.h );

        //if( this.Rblur !== 0 ) this.finalPixels = stackBlurCanvasRGB( this.finalPixels, this.w, this.h, this.Rblur );



        // http://www.arahaya.com/imagefilters/
        if( this.blur !== 0 ) this.finalPixels = ImageFilters.GaussianBlur( this.finalPixels, this.blur );
        if( this.blurX > 1 || this.blurY > 1 ) this.finalPixels = ImageFilters.BoxBlur( this.finalPixels, this.blurX, this.blurY, this.quality);
        if( this.Rblur !== 0 ) this.finalPixels = ImageFilters.StackBlur( this.finalPixels, this.Rblur );
        if( this.Dither  !== 0 ) this.finalPixels = ImageFilters.Dither( this.finalPixels, this.Dither );
        if( this.sharpen  !== 0 ) this.finalPixels = ImageFilters.Sharpen( this.finalPixels, this.sharpen );


        if( newgeo ) this.geometry = new THREE.PlaneBufferGeometry( 2, 2, this.w-1, this.h-1 );

        var vertices = this.geometry.attributes.position.array;
        var i = vertices.length/3;
        var n3, n4, v;
        var data = this.finalPixels.data;

        while(i--){
        //for(var i=0; i< lng ; i++ ){
            n3 = i*3;
            n4 = i*4;
            // CIE luminance for the RGB
            v = 0.2126*data[n4] + 0.7152*data[n4+1] + 0.0722*data[n4+2];
            vertices[n3+2] = v * 0.00392156862745098 /// 255;
        }

        if( !newgeo ) this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();

        if( newgeo ){
            this.plane = new THREE.Mesh( this.geometry, this.material );
            this.scene.add( this.plane );
        }

        //clearTimeout( this.timer1 );
        //this.timer1 = setTimeout( this.render.bind(this) , 17 );

        this.render();

    },

    render : function(){

        this.renderer.render( this.scene, this.camera, this.renderTarget, false );

        clearTimeout( this.timer );
        this.timer = setTimeout( this.dispose.bind(this) , 17 );

    },

    dispose : function(){

        if(this.geometry === null) return;

        this.scene.remove( this.plane );
        this.geometry.dispose();

        this.plane = null;
        this.geometry = null;

    },

    save:function(){
        if(this.geometry === null) this.makeTerrain();


        var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( this.w, this.h );

        renderer.render( this.scene, this.camera ); 

        window.open( renderer.domElement.toDataURL( 'image/png' ), 'screenshot' );

    }

}